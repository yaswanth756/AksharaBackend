import NodeCache from "node-cache";

// Standard TTL of 1 hour (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600 });

// Short TTL of 2 minutes (120 seconds) for optimization
export const shortCache = new NodeCache({ stdTTL: 120 });

export default cache;
