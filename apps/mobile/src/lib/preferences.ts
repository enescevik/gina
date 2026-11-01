import {sessionStorage} from './storage';
/** Non-sensitive per-user UI preferences; callers tolerate unavailable browser storage. */
export const preferences={
 async get(key:string){return sessionStorage?sessionStorage.getItem(key):globalThis.localStorage.getItem(key);},
 async set(key:string,value:string){if(sessionStorage)await sessionStorage.setItem(key,value);else globalThis.localStorage.setItem(key,value);},
};
