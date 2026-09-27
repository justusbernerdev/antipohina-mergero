/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as http from "../http.js";
import type * as keys from "../keys.js";
import type * as lib_analysis from "../lib/analysis.js";
import type * as lib_buyers from "../lib/buyers.js";
import type * as lib_consolidation from "../lib/consolidation.js";
import type * as lib_criteria from "../lib/criteria.js";
import type * as lib_industries from "../lib/industries.js";
import type * as lib_net from "../lib/net.js";
import type * as lib_score from "../lib/score.js";
import type * as lib_types from "../lib/types.js";
import type * as lib_xbrl from "../lib/xbrl.js";
import type * as mcp from "../mcp.js";
import type * as pipeline from "../pipeline.js";
import type * as runs from "../runs.js";
import type * as selda from "../selda.js";
import type * as sources_dk from "../sources/dk.js";
import type * as sources_fi from "../sources/fi.js";
import type * as sources_no from "../sources/no.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  http: typeof http;
  keys: typeof keys;
  "lib/analysis": typeof lib_analysis;
  "lib/buyers": typeof lib_buyers;
  "lib/consolidation": typeof lib_consolidation;
  "lib/criteria": typeof lib_criteria;
  "lib/industries": typeof lib_industries;
  "lib/net": typeof lib_net;
  "lib/score": typeof lib_score;
  "lib/types": typeof lib_types;
  "lib/xbrl": typeof lib_xbrl;
  mcp: typeof mcp;
  pipeline: typeof pipeline;
  runs: typeof runs;
  selda: typeof selda;
  "sources/dk": typeof sources_dk;
  "sources/fi": typeof sources_fi;
  "sources/no": typeof sources_no;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
