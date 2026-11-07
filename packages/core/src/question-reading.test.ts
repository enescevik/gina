import {describe,it,expect} from "vitest";
import {selectLocalQuestionVoice} from "./question-reading";
describe("question reading privacy policy",()=>{
 const remote={identifier:"remote",language:"tr-TR",localService:false};
 const local={identifier:"local",language:"tr-TR",localService:true};
 it("never selects a network web voice",()=>expect(selectLocalQuestionVoice("web",[remote,local],"tr-TR")).toBe("local"));
 it("fails closed when local property is absent on web",()=>expect(selectLocalQuestionVoice("web",[{identifier:"unknown",language:"tr-TR"}],"tr")).toBeNull());
 it("does not silently read with a different language",()=>expect(selectLocalQuestionVoice("web",[local],"en-US")).toBeNull());
 it("selects an explicitly installed offline Android voice",()=>expect(selectLocalQuestionVoice("android",[remote,local],"tr-TR")).toBe("local"));
 it("fails closed with old or network Android voice descriptors",()=>expect(selectLocalQuestionVoice("android",[{identifier:"old",language:"tr-TR"},remote],"tr-TR")).toBeNull());
 it("uses an available system voice on iOS",()=>expect(selectLocalQuestionVoice("ios",[{identifier:"installed",language:"tr-TR"}],"tr-TR")).toBe("installed"));
});
