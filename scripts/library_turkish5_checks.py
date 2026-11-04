"""Draft integrity and explicit language facts; not an automatic response grader."""
import hashlib
import json
CODES={'T.O.5.6','T.O.5.7','T.O.5.20','T.Y.5.13','T.Y.5.16'}
# Canonical source bodies are pinned after author self-review. They are original fiction.
SOURCE_DIGESTS={'table-game': '41927eb5594d9d7cc19f6ca3d60898f17fb30ab2e57490c86af8a545f8f89bd3', 'game-notice': '40bbcb8303cb9293a85da73dc19c3cae828f1b1b180954f4927d15a12991c1b4', 'play-poster': 'eaa8f9e97c9608bd828d186a4c231f79addd1efdf568aef90ea836f3d2ebb83c', 'box-sequence': '92541500edfb92419993b945fa3576265004af63143b941d85291617a1b2eb05', 'word-stage': '7ddde95f363931d63f421908e2c62254978919bbbfe407da4e9677fa26c88394'}
def need(ok,why):
    if not ok:raise ValueError(why)
def case_scope(n):
    code='T.O.5.6' if n<=6 else 'T.O.5.7' if n<=10 else 'T.O.5.20' if n<=14 else 'T.Y.5.13' if n<=17 else 'T.Y.5.16'
    src='table-game' if n<=3 else 'game-notice' if n<=6 else 'play-poster' if n<=8 else 'box-sequence' if n<=10 else 'word-stage' if n<=14 else None
    return code,src
RESULTS={
1:{'people':['Ada','Kerem'],'time':'Salı öğle arası','place':'sınıftaki boş masa','material':'şişe kapakları'},
2:{'Ada':'durakları büyüttü','Kerem':'başlangıç noktasına ok ekledi'},
3:{'caps':'kutu','board':'dolabın üst rafı','when':'ertesi gün','action':'aynı oyunu yeniden kurmak'},
4:{'day':'cuma','when':'son dersin ardından','place':'okul bahçesi','rain_place':'spor salonu'},
5:{'deadline':'perşembe öğle arasına kadar','list':'sınıftaki liste','bring_toy':False,'provider':'kulüp'},
6:{'order':['kuralların okunması','grupların kurulması'],'duration_given':False},
7:{'symbols':['dice','puzzle'],'purpose':'shared_play'},
8:{'day':'Cumartesi','time':'14.30','place':'Okul bahçesi','ticket_requirement_known':False},
9:{'moved':'circle','from':'outside','to':'inside','unchanged':['square','triangle']},
10:{'change':'lid_closed','inside_visible':False,'empty_proven':False},
11:{'pairs':[['öykü','hikâye'],['yanıt','cevap']]},12:{'pairs':[['açık','kapalı'],['yavaş','hızlı']]},
13:{'senses':['face','number_100']},14:{'senses':['flower','smile_command']},
15:{'open_response':True,'focus':['game','materials','place']},16:{'open_response':True,'focus':['welcome','clear_action','help']},17:{'open_response':True,'actions':['set_up_game','put_pieces_in_box','clean_table']},
18:{'ordinal':'5.','time':'14.30','sentence_final':'.'},
19:{'syllables':{'arkadaşlık':['ar','ka','daş','lık'],'oyuncak':['o','yun','cak'],'kitaplık':['ki','tap','lık']}},
20:{'valid_choice':'B','broken_syllable':'daş','other_breaks':[['ar-','kadaşlık'],['arkadaş-','lık']],'hyphen_line':1}}
# Minimal answer consistency checks, deliberately not proof of full semantic correctness.
FRAGMENTS={1:['Ada','Kerem','salı','şişe kapak'],2:['Ada durakları büyüttü','Kerem başlangıç'],3:['kutuya','üst rafına','ertesi gün'],4:['Cuma','spor salonuna'],5:['Perşembe','gerekmiyor'],6:['Önce kurallar','Süre metinde belirtilmiyor'],7:['Zar','yapboz'],8:['14.30','doğrulanamaz'],9:['Daire','dışındadır','içindedir'],10:['görünmez','boş olduğu söylenemez'],11:['hikâye','cevap'],12:['Açık–kapalı','yavaş–hızlı'],13:['başın ön','bir sayıdır'],14:['bir çiçektir','gülmek'],15:['Örnek:','Başka'],16:['Örnek:','başka'],17:['Örnek:','başka'],18:['5. sınıf','14.30’da','sıra bildirir'],19:['ar-ka-daş-lık','o-yun-cak','ki-tap-lık'],20:['B uygundur','d/aş','ilk satırın sonunda']}
def check_question(q,sources):
    v=q['verification'];n=v.get('case')
    need(v.get('type')=='turkish5_case' and type(n) is int and 1<=n<=20 and q['id']==f'g5-turkish-{n:02}','turkish5_case_identity')
    code,src=case_scope(n)
    need(q['curriculum']['candidate_code']==code,'turkish5_mapping')
    need(q['source_id']==src,'turkish5_source_link')
    need(json.dumps(v['result'],sort_keys=True)==json.dumps(RESULTS[n],sort_keys=True),'turkish5_fact')
    need(set(sources)==set(SOURCE_DIGESTS),'turkish5_sources')
    for key,digest in SOURCE_DIGESTS.items():
        need(hashlib.sha256(sources[key]['body'].encode()).hexdigest()==digest,'turkish5_source_revision')
    need(all(f.casefold() in q['expected_answer'].casefold() for f in FRAGMENTS[n]),'turkish5_answer_consistency')
    need(q['response'].get('answer_matching')=='human_semantic_review_not_exact_text' and q['response'].get('example_is_exhaustive') is False,'turkish5_open_scoring')
    need(q['response'].get('written_words_required') is True,'turkish5_written_evidence')
    need(q['response'].get('visual_alternative_affects_evidence') is (7<=n<=10),'turkish5_visual_accommodation')

def check_diagram(d,svg,ns):
    texts=[e.text for e in svg.findall('s:text',ns)]
    if d['type']=='turkish5_poster':
        need(d=={'type':'turkish5_poster','title':'BİRLİKTE OYNAYALIM','day':'Cumartesi','time':'14.30','place':'Okul bahçesi','message':'Bir oyun öner, birlikte dene.','symbols':['dice','puzzle']},'turkish5_poster_data')
        need(texts==[d[k] for k in ['title','day','time','place','message']],'turkish5_poster_text')
        groups=svg.findall('s:g',ns);need([g.get('data-symbol') for g in groups]==d['symbols'],'turkish5_poster_symbols')
        need(len(groups[0].findall('s:circle',ns))==5 and len(groups[1].findall('s:path',ns))==2,'turkish5_poster_graphics')
    elif d['type']=='turkish5_sequence':
        need(d['panels']==[{'label':'K','lid':'open','inside':['square','triangle'],'outside':['circle']},{'label':'L','lid':'open','inside':['square','triangle','circle'],'outside':[]},{'label':'M','lid':'closed','inside_visible':False,'outside':[]}],'turkish5_sequence_data')
        need(texts==['K','L','M'],'turkish5_panel_order')
        for i,p in enumerate(d['panels']):
            box=svg.find(f"s:g[@data-box='{p['label']}']",ns)
            need(box is not None and box.get('data-lid')==p['lid'],'turkish5_lid')
            shapes=[el for el in box if 'data-piece' in el.attrib]
            expected=[(name,'inside') for name in p.get('inside',[])]+[(name,'outside') for name in p['outside']]
            need([(el.get('data-piece'),el.get('data-position')) for el in shapes]==expected,'turkish5_visible_pieces')
            # Real geometry, not just data-position labels: shapes must be on the correct side.
            y=190+i*340
            for j,el in enumerate(shapes):
                name,position=expected[j];x=505 if position=='outside' else [185,280,375][j]
                if name=='circle':need(float(el.get('cx'))==x and float(el.get('cy'))==y,'turkish5_piece_geometry')
                elif name=='square':need(float(el.get('x'))==x-30 and float(el.get('y'))==y-30,'turkish5_piece_geometry')
                elif name=='triangle':need(el.get('d')==f'M {x} {y-34} L {x+34} {y+30} H {x-34} Z','turkish5_piece_geometry')
    else:raise ValueError('unregistered_diagram')
