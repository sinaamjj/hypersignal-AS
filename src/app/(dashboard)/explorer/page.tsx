
'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getWalletData } from '@/ai/flows/get-wallet-data';
import { findWalletsByCoin, WalletPosition } from '@/ai/flows/find-wallets-by-coin';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

type WalletData = {
  pnl: string;
  roi: string;
  positions: any[];
};

export default function ExplorerPage() {
  const [walletAddress, setWalletAddress] = React.useState('');
  const [walletLoading, setWalletLoading] = React.useState(false);
  const [walletData, setWalletData] = React.useState<WalletData | null>(null);
  const [walletError, setWalletError] = React.useState<string | null>(null);

  const [coin, setCoin] = React.useState('');
  const [coinLoading, setCoinLoading] = React.useState(false);
  const [coinPositions, setCoinPositions] = React.useState<WalletPosition[] | null>(null);
  const [coinError, setCoinError] = React.useState<string | null>(null);

  const handleWalletSearch = async () => {
    if (!walletAddress) {
      setWalletError('Please enter a wallet address.');
      return;
    }
    setWalletError(null);
    setWalletLoading(true);
    setWalletData(null);
    try {
      const data = await getWalletData({ address: walletAddress });
      setWalletData(data);
    } catch (e: any) {
      setWalletError(e.message || 'An unexpected error occurred.');
    } finally {
      setWalletLoading(false);
    }
  };

  const handleCoinSearch = async () => {
    if (!coin) {
      setCoinError('Please enter a coin symbol.');
      return;
    }
    setCoinError(null);
    setCoinLoading(true);
    setCoinPositions(null);
    try {
      const data = await findWalletsByCoin({ coin });
      // Sort by position value descending
      const sortedPositions = data.positions.sort((a, b) => parseFloat(b.positionValue) - parseFloat(a.positionValue));
      setCoinPositions(sortedPositions);
    } catch (e: any) {
      setCoinError(e.message || 'An unexpected error occurred.');
    } finally {
      setCoinLoading(false);
    }
  };


  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Explorer</h1>
        <p className="text-muted-foreground">
          Explore data from any Hyperliquid wallet or find wallets by coin.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Explorer</CardTitle>
              <CardDescription>
                Enter a wallet address to view its performance and positions.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex w-full max-w-md items-center space-x-2">
                <Input
                  type="text"
                  placeholder="0x..."
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  disabled={walletLoading}
                />
                <Button onClick={handleWalletSearch} disabled={walletLoading}>
                  {walletLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {walletError && (
                <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{walletError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle>Coin Explorer</CardTitle>
              <CardDescription>
                Find which of your tracked wallets hold a specific coin.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex w-full max-w-md items-center space-x-2">
                <Input
                  type="text"
                  placeholder="e.g. BTC"
                  value={coin}
                  onChange={(e) => setCoin(e.target.value)}
                  disabled={coinLoading}
                />
                <Button onClick={handleCoinSearch} disabled={coinLoading}>
                  {coinLoading ? 'Searching...' : 'Search'}
                </Button>
              </div>
              {coinError && (
                <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{coinError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
      </div>
      
      {walletData && (
        <>
            <Separator />
            <h2 className="text-xl font-semibold tracking-tight">Wallet Search Results</h2>
             <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    <div>
                      <Label>Total PnL</Label>
                      <p className="text-2xl font-bold">${walletData.pnl}</p>
                    </div>
                    <div>
                      <Label>ROI</Label>
                      <p className="text-2xl font-bold">{walletData.roi}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Open Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  {walletData.positions.length > 0 ? (
                    <pre className="p-4 bg-muted rounded-md overflow-x-auto text-sm">
                      {JSON.stringify(walletData.positions, null, 2)}
                    </pre>
                  ) : (
                    <p>No open positions.</p>
                  )}
                </CardContent>
              </Card>
            </div>
        </>
      )}

      {coinPositions && (
        <>
          <Separator />
          <h2 className="text-xl font-semibold tracking-tight">
            Coin Search Results for "{coin.toUpperCase()}"
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Wallets Holding {coin.toUpperCase()}</CardTitle>
              <CardDescription>
                {coinPositions.length} tracked wallet(s) found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coinPositions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Wallet</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Value (USD)</TableHead>
                      <TableHead>Entry Price</TableHead>
                       <TableHead className="text-right">Position Opened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coinPositions.map((p) => (
                      <TableRow key={p.address}>
                        <TableCell className="font-mono text-xs">{p.address}</TableCell>
                        <TableCell className="font-medium">{parseFloat(p.positionSize).toLocaleString()} {p.coin}</TableCell>
                        <TableCell>${parseFloat(p.positionValue).toLocaleString()}</TableCell>
                        <TableCell>${parseFloat(p.entryPrice).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                            <span title={format(parseISO(p.timestamp), 'PPpp')}>
                                {formatDistanceToNow(parseISO(p.timestamp), { addSuffix: true })}
                            </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p>
                  No tracked wallets are currently holding a position in{' '}
                  {coin.toUpperCase()}.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

    </div>
  );
}
