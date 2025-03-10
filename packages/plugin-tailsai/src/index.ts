import { Plugin } from "@elizaos/core"; // Adjust path
import { YieldService } from "./services/yieldService";
import { yieldProvider } from "./providers/yieldProvider";
import { yieldPostgresAdapter } from "./adapters/yieldPostgresAdapter";

export const tailsAIPlugin: Plugin = {
    name: "tailsAIPlugin",
    description: "Yield data scraper for Sonic blockchain",
    actions: [],
    services: [new YieldService()], // Pass adapter instance
    providers: [],
    adapters: [],
};

export default tailsAIPlugin;