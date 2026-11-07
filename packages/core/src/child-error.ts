/** Child screens never display provider text, upgrade prompts, or diagnostic details. */
export function childErrorMessageKey(error:unknown){
 const details=typeof error==='object'&&error!==null?error as {message?:unknown;code?:unknown}:{};
 const values=[typeof error==='string'?error:null,details.message,details.code].filter((v):v is string=>typeof v==='string').map(v=>v.slice(0,512));
 const message=values.join(' ');
 if(/\bpin_locked\b/i.test(message))return 'childError.waitPin' as const;
 if(/\binvalid_pin\b/i.test(message))return 'childError.tryPin' as const;
 if(/network|fetch|connection|timeout|abort/i.test(message))return 'childError.connection' as const;
 return 'childError.retry' as const;
}
