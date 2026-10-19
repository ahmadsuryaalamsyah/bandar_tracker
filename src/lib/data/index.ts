import { registerProvider, getProvider, DataProviderError } from "./provider";
import { YahooFinanceProvider } from "./providers/yahoo";

registerProvider(new YahooFinanceProvider());

export { getProvider, registerProvider, DataProviderError };
export type { StockDataProvider, DataErrorCode } from "./provider";
export * from "./types";
