// Runs only against the disposable loopback services created by the Python runner.
import { randomUUID, randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export async function testBackoffice({admin,client,parent,other,child,must,assert}) {
  const rpc=(c,name,args,label=name)=>must(c.rpc(name,args),label);
  const denied=async(c,name,args,label)=>assert(label,!!(await c.rpc(name,args)).error);
  async function operator(role) {
    const email=`gina-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
    const {user}=await must(admin.auth.admin.createUser({email,password,email_confirm:true}),'bo_create_'+role);
    await must(admin.from('operations_members').insert({user_id:user.id,role,expires_at:new Date(Date.now()+3600000).toISOString()}),'bo_grant_'+role);
    const c=client(); await must(c.auth.signInWithPassword({email,password}),'bo_login_'+role);
    assert('bo_live_role_'+role,isDeepStrictEqual(await rpc(c,'my_operation_roles',{},'bo_roles_'+role),[role]));
    return {c,id:user.id};
  }
  const support=await operator('support'),content=await operator('content');
  const ticketArgs={p_request_id:randomUUID(),p_kind:'support',p_category:'device',p_subject:'Synthetic pairing help',p_body:'Synthetic family question'};
  const ticket=await rpc(parent,'create_help_ticket',ticketArgs,'bo_parent_opens_ticket');
  assert('bo_ticket_replay_single',isDeepStrictEqual(ticket,await rpc(parent,'create_help_ticket',ticketArgs,'bo_ticket_replay')));
  await denied(other,'get_help_ticket',{p_ticket_id:ticket.id},'bo_foreign_family_ticket_denied');
  await denied(child,'get_help_ticket',{p_ticket_id:ticket.id},'bo_child_private_support_denied');
  await denied(content.c,'get_help_ticket',{p_ticket_id:ticket.id},'bo_content_cannot_read_support');
  const queue=await rpc(support.c,'list_operator_help_tickets',{},'bo_support_queue');
  assert('bo_queue_contains_ticket',JSON.stringify(queue).includes(ticket.id));
  const noteArgs={p_request_id:randomUUID(),p_ticket_id:ticket.id,p_revision:1,p_body:'Synthetic INTERNAL note',p_internal:true,p_status:'in_progress'};
  const note=await rpc(support.c,'reply_help_ticket',noteArgs,'bo_internal_note');
  assert('bo_note_replay_single',isDeepStrictEqual(note,await rpc(support.c,'reply_help_ticket',noteArgs,'bo_note_replay')));
  const replyArgs={p_request_id:randomUUID(),p_ticket_id:ticket.id,p_revision:2,p_body:'Synthetic answer visible to family',p_internal:false,p_status:'waiting_parent'};
  await rpc(support.c,'reply_help_ticket',replyArgs,'bo_family_reply');
  await denied(support.c,'reply_help_ticket',{...replyArgs,p_request_id:randomUUID()},'bo_stale_reply_denied');
  const familyView=await rpc(parent,'get_help_ticket',{p_ticket_id:ticket.id},'bo_family_reads_reply');
  assert('bo_internal_note_never_reaches_parent',familyView.messages.length===2&&!JSON.stringify(familyView).includes('INTERNAL'));
  const staffView=await rpc(support.c,'get_help_ticket',{p_ticket_id:ticket.id},'bo_staff_reads_note');
  assert('bo_internal_note_staff_only',staffView.messages.length===3&&staffView.messages.filter(m=>m.visibility==='internal').length===1);
  await denied(parent,'reply_help_ticket',{...noteArgs,p_request_id:randomUUID(),p_revision:3},'bo_parent_cannot_write_private_note');
  await rpc(parent,'reply_help_ticket',{p_request_id:randomUUID(),p_ticket_id:ticket.id,p_revision:3,p_body:'Synthetic follow-up'},'bo_parent_followup');
  const followed=await rpc(parent,'get_help_ticket',{p_ticket_id:ticket.id},'bo_followup_state');
  assert('bo_followup_reopens_waiting_ticket',followed.status==='open'&&followed.revision===4);

  const articleId=randomUUID();
  const articleArgs={p_request_id:randomUUID(),p_id:articleId,p_revision:0,p_slug:'qa-'+randomUUID(),p_locale:'tr',p_platform:'all',p_title:'Synthetic help article',p_body:'Synthetic reviewed family instruction.'};
  await denied(support.c,'save_help_article',articleArgs,'bo_support_cannot_edit_articles');
  await denied(parent,'save_help_article',articleArgs,'bo_parent_cannot_edit_articles');
  const saved=await rpc(content.c,'save_help_article',articleArgs,'bo_save_article_draft');
  assert('bo_article_replay_single',isDeepStrictEqual(saved,await rpc(content.c,'save_help_article',articleArgs,'bo_article_replay')));
  const articles=async(platform)=>rpc(parent,'get_help_articles',{p_locale:'tr',p_platform:platform},'bo_read_articles_'+platform);
  assert('bo_draft_hidden_from_family',!(await articles('ios')).some(a=>a.id===articleId));
  const reviewArgs={p_request_id:randomUUID(),p_id:articleId,p_revision:1,p_action:'publish',p_reason:'Synthetic acceptance'};
  await denied(content.c,'review_help_article',reviewArgs,'bo_unreviewed_publish_denied');
  await rpc(content.c,'review_help_article',{...reviewArgs,p_request_id:randomUUID(),p_action:'review'},'bo_review_article');
  await rpc(content.c,'review_help_article',reviewArgs,'bo_publish_article');
  for(const platform of ['ios','android','web'])assert('bo_published_visible_'+platform,(await articles(platform)).some(a=>a.id===articleId&&a.revision===1));
  await rpc(content.c,'save_help_article',{...articleArgs,p_request_id:randomUUID(),p_revision:1,p_body:'Synthetic new draft must remain private.'},'bo_new_draft');
  assert('bo_new_draft_preserves_live_version',(await articles('web')).find(a=>a.id===articleId)?.body===articleArgs.p_body);
  const editor=await rpc(content.c,'get_help_editor_article',{p_id:articleId},'bo_editor_versions');
  assert('bo_editor_separates_draft_and_published',editor.draft.revision===2&&editor.published.revision===1);
  await rpc(content.c,'review_help_article',{...reviewArgs,p_request_id:randomUUID(),p_revision:2,p_action:'archive'},'bo_archive_article');
  assert('bo_archive_hides_article',!(await articles('web')).some(a=>a.id===articleId));
  await must(admin.from('operations_members').update({revoked_at:new Date().toISOString()}).eq('user_id',support.id),'bo_revoke_support');
  await denied(support.c,'get_help_ticket',{p_ticket_id:ticket.id},'bo_revoked_support_old_token_denied');
  assert('bo_revoked_role_removed',(await rpc(support.c,'my_operation_roles',{},'bo_roles_after_revocation')).length===0);
  await must(admin.from('operations_members').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('user_id',content.id),'bo_expire_content');
  await denied(content.c,'get_help_editor_article',{p_id:articleId},'bo_expired_content_old_token_denied');
}
