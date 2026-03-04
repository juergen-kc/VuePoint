// Bridge package — SharedWorker + client for browser ↔ API state sync
export { createBridgeClient } from './client.js'
export type { BridgeClient, BridgeClientOptions } from './client.js'
export type { BridgeCommand, BridgeEvent, AppContext } from './types.js'
