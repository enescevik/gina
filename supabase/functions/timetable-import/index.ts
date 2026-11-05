import { handleTimetableImport } from "./handler.ts";
Deno.serve((req) => handleTimetableImport(req));
