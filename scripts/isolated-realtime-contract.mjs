// Real WebSocket subscriptions; no mocked notifications. Only the disposable runner calls this.
import {randomUUID} from 'node:crypto';
export async function observeRealtime({parent,other,child,assert}) {
  const events={parent:[],other:[],child:[]};
  const marks={parent:0,other:0,child:0};
  for(const [name,client] of Object.entries({parent,other,child})) {
    const channel=client.channel('isolated-'+randomUUID(),{config:{postgres_changes_options:{wait:true}}});
    for(const table of ['exams','exam_attempts','task_templates','task_routine_sync','task_completions','star_events']) {
      channel.on('postgres_changes',{event:'*',schema:'public',table},event=>events[name].push({table,row:event.new,type:event.eventType}));
    }
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('realtime_'+name+'_subscription_timeout')),20000);
      channel.subscribe(status=>{
        if(status==='SUBSCRIBED'){clearTimeout(timer);assert('realtime_'+name+'_subscribed',true);resolve();}
        else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timer);reject(Error('realtime_'+name+'_subscription_failed'));}
      });
    });
  }
  return {
    async expect(actor,table,test,label) {
      const deadline=Date.now()+15000;
      while(Date.now()<deadline) {
        if(events[actor].slice(marks[actor]).some(e=>e.table===table&&test(e.row))){assert(label,true);return;}
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      assert(label,false);
    },
    assertForeignEmpty(){assert('realtime_foreign_family_receives_no_rows',events.other.length===0);},
    mark(){for(const name of Object.keys(events))marks[name]=events[name].length;},
    async assertRevokedSilent(){
      // Parent receipt above is the positive control. The same WAL batch must not
      // disclose a new row to the still-connected, revoked device's old JWT.
      await new Promise(resolve=>setTimeout(resolve,1000));
      assert('realtime_revoked_old_token_receives_no_rows',events.child.length===marks.child);
      assert('realtime_foreign_family_receives_no_rows',events.other.length===0);
    },
  };
}
