import {describe,it,expect} from "vitest";
import {selectLocalQuestionVoice} from "./question-reading";
describe("question reading privacy policy",()=>{
 const remote={identifier:"remote",language:"tr-TR",localService:false};
 const local={identifier:"local",language:"tr-TR",localService:true};
 it("never selects a network web voice",()=>expect(selectLocalQuestionVoice("web",[remote,local],"tr-TR")).toBe("local"));
 it("fails closed when local property is absent on web",()=>expect(selectLocalQuestionVoice("web",[{identifier:"unknown",language:"tr-TR"}],"tr")).toBeNull());
 it("does not silently read with a different language",()=>expect(selectLocalQuestionVoice("web",[local],"en-US")).toBeNull());
 it("fails closed for Android until engine capability is exposed",()=>expect(selectLocalQuestionVoice("android",[local],"tr-TR")).toBeNull());
 it("uses an available system voice on iOS",()=>expect(selectLocalQuestionVoice("ios",[{identifier:"installed",language:"tr-TR"}],"tr-TR")).toBe("installed"));
});
