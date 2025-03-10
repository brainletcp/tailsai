import { Provider, IAgentRuntime, ServiceType } from "@elizaos/core"; // Adjust path
import { YieldService } from "../services/yieldService";

export const yieldProvider: Provider = {
    get: async (runtime: IAgentRuntime) => {
        return; /*const service = runtime.getService<YieldService>(ServiceType.YIELD_DATA);
        const data = await service.getLatestData();
        return `Yield Data: ${JSON.stringify(data.map(m => m.content.text))}`;*/
    },
};