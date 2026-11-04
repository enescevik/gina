"""Pinned checks for the original numbers/data draft. Not an editorial verdict."""
from fractions import Fraction as F
from statistics import median, multimode
from collections import Counter

CODES={'MAT.6.1.5','MAT.6.1.6','MAT.6.1.7','MAT.6.1.8','MAT.6.5.1'}

def need(ok,reason):
    if not ok: raise ValueError(reason)

def answers(sources):
    # Read values from the shared source rather than duplicating a diagram's answer.
    table=sources['scale-readings']['diagram']
    need(table=={'type':'value_table','headers':['Numune','Kütle (kg)'],'rows':[['A','4,086'],['B','1,205'],['C','1,250']]},'math6_scale_source')
    values={label:F(value.replace(',','.')) for label,value in table['rows']}
    route=sources['route']['diagram']
    need(route=={'type':'route_lengths','first_km':'1.2','second_m':'350','direct_km':'1.6'},'math6_route_source')
    dots=sources['reading-data']['diagram']
    need(dots=={'type':'frequency_dots','values':[0,1,2,3],'frequencies':[1,3,4,2],'x_label':'Bitirilen kitap sayısı'},'math6_data_source')
    observations=[v for v,n in zip(dots['values'],dots['frequencies']) for _ in range(n)]
    n=len(observations);total=sum(observations);atleast=sum(v>=2 for v in observations)
    via=F(route['first_km'])*1000+F(route['second_m']);direct=F(route['direct_km'])*1000
    # These are independent arithmetic expressions for each authored problem, not
    # accepted model-provided expressions or a general-purpose eval engine.
    return {
        1:{'value':values['A'],'eight_place':F(8,100)},
        2:{'first':F(708,1000),'second':F(78,100),'difference':F(78,100)-F(708,1000)},
        3:{'difference':values['C']-values['B'],'b':values['B'],'c':values['C']},
        4:{'value':2+F(3,10)+F(5,1000),'wrong_value':2+F(35,100)},
        5:{'share':F(5,4),'total':F(5,4)*4},
        6:{'share':F(2,3),'used':F(66,100)*3,'left':2-F(66,100)*3},
        7:{'halves':F(1,2),'quarters':F(1,4),'eighths':F(1,8),'sixteenths':F(1,16)},
        8:{'boxes':F('3.6')/F('.45')},
        9:{'discount':120*F(25,100),'pay':120*(1-F(25,100)),'left':100-120*(1-F(25,100))},
        10:{'initial':3*F('2.5'),'used':6*F(3,4),'left':3*F('2.5')-6*F(3,4)},
        11:{'distributed':72*F(5,8),'remaining':72*(1-F(5,8)),'final':72*(1-F(5,8))+9},
        12:{'portion':F(3,5)/4,'needed':F(3,5)/4*6,'left':1-F(3,5)/4*6},
        13:{'via':via,'direct':direct,'difference':direct-via},
        14:{'mm':88-23,'cm':F(88-23,10)},
        15:{'required_mm':2*1000+35*10,'available_mm':2300,'missing_mm':2*1000+35*10-2300,'missing_cm':F(2*1000+35*10-2300,10)},
        16:{'total':total,'people':n,'mean':F(total,n)},
        17:{'median':F(median(observations)),'mode':multimode(observations)[0],'range':max(observations)-min(observations)},
        18:{'cards':atleast,'percent':F(atleast,n)*100},
        19:{'editorial_reasoning':True},
        20:{'frequencies':[6,4,2],'maximum':max([6,4,2]),'editorial_reasoning':True},
    }

# Link verified quantities to the prose answer. This catches missing/stale main
# results, but cannot establish every sentence's correctness or pedagogical fit.
ANSWER_FRAGMENTS={
    1:['4 + 0/10 + 8/100 + 6/1000','8/100'],2:['708/1000','780/1000','0,072'],
    3:['1205/1000','1250/1000','45','1,250','1,25'],4:['2,305','5/1000'],
    5:['5/4','1,25'],6:['2/3','1,98','0,02','0,666'],7:['0,5','0,25','0,125','0,0625'],
    8:['8','0,45','3,6'],9:['30 TL','90 TL','10 TL'],10:['7,5','4,5','3 L'],
    11:['45','27','36'],12:['3/20','9/10','1/10'],13:['1550','1600','50'],
    14:['65 mm','6,5 cm'],15:['2350','2300','50 mm','5 cm'],16:['17','1,7'],
    17:['Ortanca 2','tepe değer 2','açıklık 3'],18:['6','%60'],19:['İsim' ],20:['6','4','2']}
# q19 uses the Turkish sentence-initial capital; compare case-insensitively.

def check_question(q,sources):
    v=q['verification'];case=v.get('case')
    need(v.get('type')=='math6_case' and type(case) is int and 1<=case<=20 and q['id']==f'g6-math-{case:02}','math6_case_identity')
    expected_code='MAT.6.1.5' if case<=4 else 'MAT.6.1.6' if case<=7 else 'MAT.6.1.7' if case<=12 else 'MAT.6.1.8' if case<=15 else 'MAT.6.5.1'
    need(q['curriculum']['candidate_code']==expected_code,'math6_question_mapping')
    expected_source='scale-readings' if case in (1,3) else 'route' if case==13 else 'reading-data' if case in (16,17,18) else 'club-data' if case==20 else None
    need(q['source_id']==expected_source,'math6_question_source')
    expected=answers(sources)[case]
    expected={k:str(F(v)) if isinstance(v,(int,F)) and not isinstance(v,bool) else v for k,v in expected.items()}
    need(v['result']==expected,'math6_numeric_result')
    need(all(fragment.casefold() in q['expected_answer'].casefold() for fragment in ANSWER_FRAGMENTS[case]),'math6_answer_result')

def check_diagram(d,svg,ns):
    texts=[t.text for t in svg.findall('s:text',ns)]
    if d['type']=='value_table':
        need(all(v in texts for row in [d['headers'],*d['rows']] for v in row),'math6_rendered_table')
    elif d['type']=='route_lengths':
        need(all(v in texts for v in ['1,2 km','350 m','1,6 km','Başlangıç','Köprü','Bitiş']),'math6_rendered_route')
        need(len(svg.findall('s:path',ns))==2,'math6_route_paths')
    elif d['type']=='frequency_dots':
        dots=[c for c in svg.findall('s:circle',ns) if 'data-value' in c.attrib]
        need(Counter(int(c.attrib['data-value']) for c in dots)==dict(zip(d['values'],d['frequencies'])),'math6_rendered_frequencies')
        coords=set()
        for c in dots:
            value=int(c.attrib['data-value']);level=int(c.attrib['data-level'])
            xy=(float(c.attrib['cx']),float(c.attrib['cy']))
            need(xy==(100+160*value,370-65*level) and xy not in coords and 0<=level<d['frequencies'][value],'math6_dot_position')
            coords.add(xy)
        need(all(str(v) in texts for v in d['values']) and d['x_label'] in texts,'math6_axis_labels')
    else: raise ValueError('unregistered_diagram')
