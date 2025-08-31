
'use server';
/**
 * @fileOverview A flow for fetching wallet data from the Hyperliquid API.
 * 
 * - getWalletData - A function that fetches wallet data.
 * - GetWalletDataInput - The input type for the getWalletData function.
 * - GetWalletDataOutput - The return type for the getWalletData function.
 */

import { ai } from '@/ai/genkit';
import { log } from '@/app/(dashboard)/logs/actions';
import { z } from 'zod';

const GetWalletDataInputSchema = z.object({
  address: z.string().describe('The wallet address.'),
});
export type GetWalletDataInput = z.infer<typeof GetWalletDataInputSchema>;

const GetWalletDataOutputSchema = z.object({
  pnl: z.string(),
  roi: z.string(),
  positions: z.any(),
});
export type GetWalletDataOutput = z.infer<typeof GetWalletDataOutputSchema>;

const getWalletDataFlow = ai.defineFlow(
  {
    name: 'getWalletDataFlow',
    inputSchema: GetWalletDataInputSchema,
    outputSchema: GetWalletDataOutputSchema,
  },
  async (input) => {
    try {
      const response = await fetch('https://api.hyperliquid.xyz/info', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              type: 'clearinghouseState',
              user: input.address,
          }),
      });

      if (!response.ok) {
          const errorBody = await response.text();
          await log({ level: 'ERROR', message: `Explorer API call failed for ${input.address}`, context: { status: response.status, body: errorBody } });
          throw new Error(`API call failed with status: ${response.status}`);
      }

      const data = await response.json();
      
      const pnl = data?.assetPositions?.[0]?.unrealizedPnl ?? '0';
      const roi = data?.assetPositions?.[0]?.returnOnEquity ?? '0';
      const positions = data?.assetPositions ?? [];

      return {
          pnl: parseFloat(pnl).toFixed(2),
          roi: (parseFloat(roi) * 100).toFixed(2),
          positions,
      };
    } catch(e: any) {
        await log({ level: 'ERROR', message: `Failed to fetch wallet data for ${input.address}`, context: { error: e.message, stack: e.stack } });
        throw new Error("Failed to fetch wallet data from Hyperliquid API. See logs for details.");
    }
  }
);


export async function getWalletData(input: GetWalletDataInput): Promise<GetWalletDataOutput> {
    return getWalletDataFlow(input);
}
