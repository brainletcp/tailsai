import { Service, ServiceType, IAgentRuntime, UUID, elizaLogger, embed } from "@elizaos/core";
import { yieldPostgresAdapter } from "../adapters/yieldPostgresAdapter";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export class YieldService extends Service {
    static override get serviceType(): ServiceType {
        return ServiceType.YIELD_DATA;
    }

    private adapter: any;
    private runtime: IAgentRuntime;
    private isRunning = false;

    async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        this.adapter = yieldPostgresAdapter.init(runtime);
        
        // Start scraping in background but don't block initialization
        this.startScrapeLoop();

         // Optionally start the MCP server if enabled
         if (runtime.getSetting("ENABLE_MCP_SERVER") === "true") {
            this.startMcpServer().catch(err => {
                elizaLogger.error("Failed to start MCP server:", err);
            });
        }
    }
    
    private async startScrapeLoop(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;
        
        setTimeout(async () => {
            while (this.isRunning) {
                try {
                    await this.scrapeData();
                    elizaLogger.info(`YieldService: Data scraping done.`)
                } catch (error) {
                    elizaLogger.error("Error scraping yield data:", error);
                }
                await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
            }
        }, 0);
    }

    private async scrapeData(): Promise<void> {
        try {
            const response = await fetch("https://yields.llama.fi/pools");
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);

            const data = await response.json();
            const sonicPools = data.data.filter((pool: any) => pool.chain === "Sonic");

            if (sonicPools.length === 0) {
                elizaLogger.warn("No Sonic chain pools found in DeFi Llama data");
                return;
            }

            elizaLogger.info(`YieldService: Found ${sonicPools.length} Sonic pools`);

            for (const pool of sonicPools) {
                await this.adapter.createYieldRecord(pool);
            }

        } catch (error) {
            elizaLogger.error("Error fetching from DeFi Llama:", error);
            throw error;
        }
    }

    async startMcpServer(): Promise<void> {
        // Create an MCP server
        const server = new McpServer({
            name: "Yield Data Service",
            version: "1.0.0"
        });

        // Add a resource to get all yield data
        server.resource(
            "all-pools",
            "yield://pools",
            async (uri) => {
                const records = await this.adapter.getYieldRecords();

                // Format each record as a separate content item with proper MIME type
                return {
                    contents: records.map(record => {
                        const data = JSON.parse(record.content.text);
                        return {
                            uri: `yield://pools/${data.poolid || data.pool || 'unknown'}`,
                            mimeType: "application/json",
                            text: JSON.stringify(data, null, 2)
                        };
                    })
                };
            }
        );

        // Start the server with stdio transport
        const transport = new StdioServerTransport();
        await server.connect(transport);

        elizaLogger.info("MCP server started for Yield Data Service");
    }
}

