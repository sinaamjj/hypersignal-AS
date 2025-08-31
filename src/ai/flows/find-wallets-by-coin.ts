
'use server';
/**
 * @fileOverview A flow for finding wallets that hold a specific coin, including position details.
 * 
 * - findWalletsByCoin - A function that finds wallets by coin and returns detailed position info.
 * - FindWalletsByCoinInput - The input type for the findWalletsByCoin function.
 * - FindWalletsByCoinOutput - The return type for the findWalletsByCoin function.
 */

import { ai } from '@/ai/genkit';
import { getTrackedAddresses } from '@/app/(dashboard)/wallets/actions';
import { log } from '@/app/(dashboard)/logs/actions';
import { z } from 'zod';

const FindWalletsByCoinInputSchema = z.object({
  coin: z.string().describe('The coin symbol to search for (e.g., BTC, ETH).'),
});
export type FindWalletsByCoinInput = z.infer<typeof FindWalletsByCoinInputSchema>;


const WalletPositionSchema = z.object({
    address: z.string(),
    coin: z.string(),
    positionSize: z.string(),
    entryPrice: z.string(),
    positionValue: z.string(),
    timestamp: z.string(),
});
export type WalletPosition = z.infer<typeof WalletPositionSchema>;

const FindWalletsByCoinOutputSchema = z.object({
    positions: z.array(WalletPositionSchema).describe('A list of wallets and their position details for the specified coin.'),
});
export type FindWalletsByCoinOutput = z.infer<typeof FindWalletsByCoinOutputSchema>;


async function getFirstFillTimestamp(address: string, coin: string): Promise<string> {
    try {
        const response = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'userFills', user: address }),
        });
        if (!response.ok) return new Date().toISOString();
        const fills = await response.json();
        
        const coinFills = fills.filter((f: any) => f.coin === coin).sort((a: any, b: any) => a.time - b.time);
        
        if (coinFills.length > 0) {
            // Find the timestamp of the fill that opened the current position
            let currentSize = 0;
            for (let i = coinFills.length - 1; i >= 0; i--) {
                const fill = coinFills[i];
                const fillSize = fill.side === 'B' ? parseFloat(fill.sz) : -parseFloat(fill.sz);
                currentSize += fillSize;
                // This logic is simplified: it finds the earliest fill of the current "session"
                // A more complex logic would be needed to track historical open/close cycles perfectly.
                if ((currentSize > 0 && fill.side === 'A') || (currentSize < 0 && fill.side === 'B')) {
                   // This fill was closing a previous position, so the one after it opened the current one.
                   return new Date(coinFills[i+1]?.time ?? fill.time).toISOString();
                }
            }
            return new Date(coinFills[0].time).toISOString();
        }

        return new Date().toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
}


const findWalletsByCoinFlow = ai.defineFlow(
  {
    name: 'findWalletsByCoinFlow',
    inputSchema: FindWalletsByCoinInputSchema,
    outputSchema: FindWalletsByCoinOutputSchema,
  },
  async (input) => {
    try {
      const trackedAddresses = await getTrackedAddresses();
      if (trackedAddresses.length === 0) {
        return { positions: [] };
      }

      const holdingPositions: WalletPosition[] = [];
      const coinUpperCase = input.coin.toUpperCase();
      
      const statePromises = trackedAddresses.map(address => 
        fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'clearinghouseState', user: address }),
        }).then(res => res.json().catch(() => null)).then(data => ({address, data}))
      );

      const results = await Promise.all(statePromises);

      for (const { address, data } of results) {
          if (!data) continue;
          
          const positions = data?.assetPositions ?? [];
          const targetPosition = positions.find((pos: any) => pos?.position?.coin?.toUpperCase() === coinUpperCase && parseFloat(pos?.position?.szi) !== 0);

          if (targetPosition) {
              const posDetails = targetPosition.position;
              const positionSize = parseFloat(posDetails.szi);
              const entryPrice = parseFloat(posDetails.entryPx);
              const positionValue = positionSize * entryPrice;

              // This is a simplification; for a precise timestamp, we'd need to analyze fills.
              const timestamp = await getFirstFillTimestamp(address, coinUpperCase);

              holdingPositions.push({
                  address,
                  coin: posDetails.coin,
                  positionSize: positionSize.toFixed(4),
                  entryPrice: entryPrice.toFixed(4),
                  positionValue: positionValue.toFixed(2),
                  timestamp,
              });
          }
      }

      return { positions: holdingPositions };

    } catch(e: any) {
        await log({ level: 'ERROR', message: `Failed to execute findWalletsByCoin flow for coin: ${input.coin}`, context: { error: e.message, stack: e.stack } });
        throw new Error("Failed to find wallets by coin. See logs for details.");
    }
  }
);

export async function findWalletsByCoin(input: FindWalletsByCoinInput): Promise<FindWalletsByCoinOutput> {
    return findWalletsByCoinFlow(input);
}
