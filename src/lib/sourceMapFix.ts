// Workaround for the missing export in source-map-js
import sourceMap from "source-map-js";

// @ts-ignore
export const SourceMapConsumer = sourceMap.SourceMapConsumer;
