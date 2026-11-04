"""Independent facts/arithmetic and rendered-geometry checks, not subject review."""
import math
import json
CODES={'FB.6.1.1','FB.6.1.3','FB.6.2.1','FB.6.2.2','FB.6.2.3'}
ORDER=['Merkür','Venüs','Dünya','Mars','Jüpiter','Satürn','Uranüs','Neptün']
def need(ok,reason):
    if not ok:raise ValueError(reason)
def answers(sources):
    rows=sources['planet-cards']['diagram']['rows']
    expected=[[name,'K' if i<4 else 'G' if i<6 else 'B','Yok' if i<4 else 'Var'] for i,name in enumerate(ORDER)]
    need(rows==expected,'science6_planet_source')
    models=sources['eclipse-models']['diagram']
    need(models=={'type':'science6_eclipses','rows':[['Güneş','Ay','Dünya'],['Güneş','Dünya','Ay']],'labels':['K','L']},'science6_eclipse_source')
    force=sources['force-cards']['diagram']['rows']
    need(force==[{'label':'K','forces':[7,-3]},{'label':'L','forces':[5,-5]},{'label':'M','forces':[2,6]}],'science6_force_source')
    need(all(type(n) is int for r in force for n in r['forces']),'science6_force_units')
    net=[sum(r['forces']) for r in force]
    route=sources['two-routes']['diagram']
    need(route=={'type':'science6_routes','points':{'A':[140,400],'B':[720,400],'C':[140,130],'D':[720,130]},'paths':[['A','B'],['A','C','D','B']]},'science6_route_source')
    paths=[[route['points'][key] for key in path] for path in route['paths']]
    length=lambda p:sum(math.dist(a,b) for a,b in zip(p,p[1:]))
    need(length(paths[1])>length(paths[0]) and paths[0][0]==paths[1][0] and paths[0][-1]==paths[1][-1],'science6_route_relation')
    return {
      1:{'terrestrial':[r[0] for r in rows if r[1]=='K'],'outer':[r[0] for r in rows if r[1]!='K']},
      2:{'ringed':[r[0] for r in rows if r[2]=='Var']},3:{'planet':rows[2][0],'order':3},4:{'order':ORDER,'belt':['Mars','Jüpiter']},
      5:{'K':'solar','L':'lunar','shadow_K':'Earth','shadow_L':'Moon'},6:{'middle_L':models['rows'][1][1],'light_source':'Güneş'},
      7:{'editorial_reasoning':True},8:{'editorial_reasoning':True},
      9:{'net_N':net[0],'direction':'east' if net[0]>0 else 'west','axis':'east_west'},
      10:{'net_N':net[1],'direction':None},11:{'net_N':net[2],'direction':'east' if net[2]>0 else 'west','axis':'east_west'},
      12:{'added_N':-net[0],'final_N':net[0]+(-net[0])},13:{'A':'balanced','B':'unbalanced'},14:{'editorial_reasoning':True},
      15:{'longer_path':'mint','same_displacement':True,'faster_average_speed':'mint','same_average_velocity':True},
      16:{'distance_positive':True,'displacement_zero':True,'average_speed_positive':True,'average_velocity_zero':True},
      17:{'same_speed':True,'same_velocity':False},18:{'constant_speed':True,'constant_velocity':False},
      19:{'speed_log':1,'velocity_log':2},20:{'same_average_speed':True,'same_average_velocity':True,'same_at_every_moment':False},
    }
# Presence checks only: these do not prove every sentence or rubric is correct.
FRAGMENTS={1:['Merkür','Neptün','buz devi'],2:['Jüpiter','Uranüs','Neptün'],3:['Dünya','üçüncü','yeterli olmaz'],4:['Mars, Jüpiter','en büyük'],
5:['Güneş tutulmasını','Ay tutulmasını','Ay ışığı','Dünya ışığı'],6:['Dünya','gölgesinde','Güneş'],7:['yanlıştır','yeterli değildir','Yörünge eğimi'],8:['Ay tutulmasını','ölçekli olmayan','hesaplanamaz'],
9:['4 N doğu','7 − 3'],10:['0 N','5 N','atanmaz'],11:['8 N doğu','2 + 6'],12:['4 N batı','7 − (3 + 4)'] ,13:['dengelenmiştir','dengelenmemiştir','tekrar'],14:['Aynı durgun','sabit','tekrarlanır'],
15:['daha büyüktür','ortalama hızları aynıdır'],16:['yer değiştirmesi sıfır','ortalama sürati sıfır değildir','ortalama hızı sıfırdır'],17:['hızları aynı değildir','yön bilgisi'],18:['hız sabit kalmaz','yönü değişir'],19:['Birinci','İkinci','yer değiştirmeyi'],20:['Her an süratleri aynı denemez','ortalama süratleri eşittir','ortalama hızları da eşittir']}
# The q12 solution's displayed equivalent equality is also accepted in prose.
FRAGMENTS[12]=['4 N batı','3 + 4 = 7','dengeleyici']
def check_question(q,sources):
    case=q['verification'].get('case')
    need(q['verification'].get('type')=='science6_case' and type(case) is int and 1<=case<=20 and q['id']==f'g6-science-{case:02}','science6_case_identity')
    code='FB.6.1.1' if case<=4 else 'FB.6.1.3' if case<=8 else 'FB.6.2.1' if case<=12 else 'FB.6.2.2' if case<=14 else 'FB.6.2.3'
    need(q['curriculum']['candidate_code']==code,'science6_mapping')
    src='planet-cards' if case<=3 else 'eclipse-models' if case in (5,6) else 'force-cards' if 9<=case<=12 else 'cart-log' if case==13 else 'two-routes' if case in (15,19) else None
    need(q['source_id']==src,'science6_question_source')
    need(json.dumps(q['verification']['result'],sort_keys=True)==json.dumps(answers(sources)[case],sort_keys=True),'science6_fact_or_result')
    need(all(fragment.casefold() in q['expected_answer'].casefold() for fragment in FRAGMENTS[case]),'science6_answer_result')
    if case>=15:
        need(q['curriculum']['evidence_scope']=='qualitative_comparison_no_speed_calculation' and q['response'].get('numerical_speed_calculation_required') is False and q['response'].get('graph_reading_required') is False,'science6_speed_scope')
    if case in (13,14):need(q['curriculum']['evidence_scope']=='written_experimental_plan_or_given_data_not_performed_experiment','science6_experiment_scope')
def check_diagram(d,svg,ns):
    texts=[t.text for t in svg.findall('s:text',ns)]
    if d['type']=='science6_planets':
        expected=['Sıra / gezegen','Yapı','Halka']+[v for i,r in enumerate(d['rows']) for v in [f'{i+1}. {r[0]}',r[1],r[2]]]
        need(texts==expected,'science6_rendered_planets')
    elif d['type']=='science6_eclipses':
        bodies=[c for c in svg.findall('s:circle',ns) if 'data-body' in c.attrib]
        need(len(bodies)==6,'science6_rendered_bodies')
        for i,row in enumerate(d['rows']):
            for j,label in enumerate(row):
                el=bodies[i*3+j];a=el.attrib
                need(a['data-row']==d['labels'][i] and a['data-body']==label and float(a['cx'])==[230,500,770][j] and float(a['cy'])==190+i*290,'science6_rendered_alignment')
        need(all(x in texts for x in ['K','L','Güneş','Dünya','Ay']),'science6_rendered_eclipse_labels')
    elif d['type']=='science6_forces':
        for i,row in enumerate(d['rows']):
            for j,n in enumerate(row['forces']):
                el=svg.find(f"s:path[@data-force='{row['label']}-{j}']",ns)
                y=130+i*185+j*50;end=450+n*38;head=end-(16 if n>0 else -16)
                expected=f'M 450 {y} L {end} {y} M {head} {y-10} L {end} {y} L {head} {y+10}'
                need(el is not None and el.attrib.get('data-newtons')==str(n) and el.attrib.get('d')==expected,'science6_rendered_force_direction')
        need(all(f'{abs(n)} N' in texts for row in d['rows'] for n in row['forces']),'science6_rendered_force_labels')
    elif d['type']=='science6_routes':
        for i,path in enumerate(d['paths']):
            el=svg.find(f"s:path[@data-route='{'purple' if i==0 else 'mint'}']",ns)
            expected=' '.join(f"{'M' if j==0 else 'L'} {d['points'][key][0]} {d['points'][key][1]}" for j,key in enumerate(path))
            need(el is not None and el.attrib.get('d')==expected,'science6_rendered_route')
        for key,(x,y) in d['points'].items():
            el=svg.find(f"s:circle[@data-point='{key}']",ns)
            need(el is not None and float(el.attrib['cx'])==x and float(el.attrib['cy'])==y,'science6_rendered_route_points')
    else:raise ValueError('unregistered_diagram')
