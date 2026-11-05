-- S04 — ders kataloğu, eşanlamlılar ve kaynaklı takvim taslağı içe aktarma.
-- Kaynak kararlar: docs/DECISIONS.md "F01 ve S04 kararları" (6 Kasım 2026).
--  * 20 yeni `subject-*` kimliği guided_input_options'a eklenir; mevcut 12 kimlik değişmez (on conflict do nothing).
--  * Eşleşme her zaman veli onaylıdır: suggest_subject yalnız aday listesi döndürür, hiçbir kayda yazmaz,
--    tek aday olsa bile requires_confirmation=true. Bilinmeyen etiket olduğu gibi kalır.
--  * Takvim tohumu yalnız TASLAK üretir (published null). Düşük güvenli kayıtlar (Düzce) atlanır.
--    Yeni il yerleri pasif açılır; yayın her zaman yöneticinin ayrı admin_save_education_calendar(...,true) adımıdır.

create table gina.subject_synonyms (
 alias_normalized text not null check(alias_normalized ~ '^[a-z0-9]{1,80}$'),
 alias text not null check(length(trim(alias)) between 1 and 80),
 subject_id text not null references public.guided_input_options(id) on delete cascade,
 grade_min int not null check(grade_min between 0 and 12),
 grade_max int not null check(grade_max between 0 and 12 and grade_max>=grade_min),
 source text not null check(source in('catalog','policy_ambiguity','admin')),
 primary key(alias_normalized,subject_id,grade_min)
);
revoke all on gina.subject_synonyms from public,anon,authenticated,service_role;
alter table gina.subject_synonyms enable row level security;

-- Aynı kural: scripts/build-subject-catalog-sql.py normalize() ve packages/core/src/subject-synonyms.ts.
create function gina.normalize_subject_alias(p text) returns text language sql immutable set search_path='' as $$
 select case when length(s)>5 and right(s,5)='dersi' then left(s,-5) else s end
 from (select regexp_replace(lower(translate(coalesce(p,''),'İIıÇçŞşĞğÖöÜüÂâÎîÛûÉé','iiiccssggoouuaaiiuuee')),'[^a-z0-9]','','g') s) x;
$$;

-- BEGIN GENERATED subject-catalog (scripts/build-subject-catalog-sql.py; source checked_at 2026-11-05)
insert into public.guided_input_options(id,kind,label_tr,label_en,min_grade,max_grade,position) values
('subject-german','subject','Almanca','German',5,12,130),
('subject-french','subject','Fransızca','French',5,12,140),
('subject-religion','subject','Din Kültürü ve Ahlak Bilgisi','Religious Culture and Ethics',4,12,150),
('subject-inkilap','subject','T.C. İnkılap Tarihi ve Atatürkçülük','History of the Turkish Revolution and Kemalism',8,12,160),
('subject-pe','subject','Beden Eğitimi','Physical Education',1,12,170),
('subject-visual-arts','subject','Görsel Sanatlar','Visual Arts',1,12,180),
('subject-music','subject','Müzik','Music',1,12,190),
('subject-ict','subject','Bilişim Teknolojileri ve Yazılım','ICT and Software',5,12,200),
('subject-technology-design','subject','Teknoloji ve Tasarım','Technology and Design',7,8,210),
('subject-traffic','subject','Trafik Güvenliği','Traffic Safety',4,4,220),
('subject-health-traffic','subject','Sağlık Bilgisi ve Trafik Kültürü','Health and Traffic Culture',9,9,230),
('subject-rights','subject','İnsan Hakları, Vatandaşlık ve Demokrasi','Human Rights, Citizenship and Democracy',4,4,240),
('subject-guidance','subject','Rehberlik ve Yönlendirme','Guidance',5,12,250),
('subject-free-activities','subject','Serbest Etkinlikler','Free Activities',1,3,260),
('subject-philosophy','subject','Felsefe','Philosophy',10,12,270),
('subject-social-science-studies','subject','Sosyal Bilim Çalışmaları','Social Science Studies',9,12,280),
('subject-quran','subject','Kur''an-ı Kerim','Quran',5,12,290),
('subject-prophet-life','subject','Peygamberimizin Hayatı','Life of the Prophet',5,12,300),
('subject-basic-religious','subject','Temel Dinî Bilgiler','Basic Religious Knowledge',5,12,310),
('subject-elective-other','subject','Seçmeli ders (diğer)','Elective (other)',1,12,320)
on conflict (id) do nothing;
insert into gina.subject_synonyms(alias_normalized,alias,subject_id,grade_min,grade_max,source) values
('turkce','Türkçe','subject-turkish',1,8,'catalog'),
('turkish','Turkish','subject-turkish',1,8,'catalog'),
('tur','TÜR','subject-turkish',1,8,'catalog'),
('trk','TRK','subject-turkish',1,8,'catalog'),
('okumayazma','Okuma Yazma','subject-turkish',1,8,'catalog'),
('ilkokumayazma','İlk Okuma Yazma','subject-turkish',1,8,'catalog'),
('matematik','Matematik','subject-math',1,12,'catalog'),
('mathematics','Mathematics','subject-math',1,12,'catalog'),
('mat','MAT','subject-math',1,12,'catalog'),
('mtm','Mtm','subject-math',1,12,'catalog'),
('math','Math','subject-math',1,12,'catalog'),
('maths','Maths','subject-math',1,12,'catalog'),
('ilkogretimmatematik','İlköğretim Matematik','subject-math',1,12,'catalog'),
('temelmatematik','Temel Matematik','subject-math',1,12,'catalog'),
('secmelimatematik','Seçmeli Matematik','subject-math',1,12,'catalog'),
('matematikuygulamalari','Matematik Uygulamaları','subject-math',1,12,'catalog'),
('hayatbilgisi','Hayat Bilgisi','subject-life',1,3,'catalog'),
('lifestudies','Life Studies','subject-life',1,3,'catalog'),
('hb','HB','subject-life',1,3,'catalog'),
('haybil','Hay. Bil.','subject-life',1,3,'catalog'),
('hayatbil','Hayat Bil.','subject-life',1,3,'catalog'),
('lifescience','Life Science','subject-life',1,3,'catalog'),
('fenbilimleri','Fen Bilimleri','subject-science',3,8,'catalog'),
('science','Science','subject-science',3,8,'catalog'),
('fen','Fen','subject-science',3,8,'catalog'),
('fenbil','Fen Bil.','subject-science',3,8,'catalog'),
('fenb','Fen B.','subject-science',3,8,'catalog'),
('fenveteknoloji','Fen ve Teknoloji','subject-science',3,8,'catalog'),
('fenbilgisi','Fen Bilgisi','subject-science',3,8,'catalog'),
('fenbilimleriuygulamalari','Fen Bilimleri Uygulamaları','subject-science',3,8,'catalog'),
('sosyalbilgiler','Sosyal Bilgiler','subject-social',4,7,'catalog'),
('socialstudies','Social Studies','subject-social',4,7,'catalog'),
('sosyal','Sosyal','subject-social',4,7,'catalog'),
('sos','SOS','subject-social',4,7,'catalog'),
('sb','SB','subject-social',4,7,'catalog'),
('sosbil','Sos. Bil.','subject-social',4,7,'catalog'),
('sosyalbil','Sosyal Bil.','subject-social',4,7,'catalog'),
('ingilizce','İngilizce','subject-english',2,12,'catalog'),
('english','English','subject-english',2,12,'catalog'),
('ing','İNG','subject-english',2,12,'catalog'),
('eng','ENG','subject-english',2,12,'catalog'),
('yabancidil','Yabancı Dil','subject-english',2,12,'catalog'),
('yabdil','Yab. Dil','subject-english',2,12,'catalog'),
('yd','YD','subject-english',2,12,'catalog'),
('1yabancidil','1. Yabancı Dil','subject-english',2,12,'catalog'),
('birinciyabancidil','Birinci Yabancı Dil','subject-english',2,12,'catalog'),
('foreignlanguage','Foreign Language','subject-english',2,12,'catalog'),
('almanca','Almanca','subject-german',5,12,'catalog'),
('german','German','subject-german',5,12,'catalog'),
('alm','ALM','subject-german',5,12,'catalog'),
('deutsch','Deutsch','subject-german',5,12,'catalog'),
('2yabancidilalmanca','2. Yabancı Dil (Almanca)','subject-german',5,12,'catalog'),
('ikinciyabancidil','İkinci Yabancı Dil','subject-german',5,12,'catalog'),
('fransizca','Fransızca','subject-french',5,12,'catalog'),
('french','French','subject-french',5,12,'catalog'),
('fra','FRA','subject-french',5,12,'catalog'),
('fr','Fr.','subject-french',5,12,'catalog'),
('francais','Français','subject-french',5,12,'catalog'),
('dinkulturuveahlakbilgisi','Din Kültürü ve Ahlak Bilgisi','subject-religion',4,12,'catalog'),
('religiouscultureandethics','Religious Culture and Ethics','subject-religion',4,12,'catalog'),
('dkab','DKAB','subject-religion',4,12,'catalog'),
('dink','Din K.','subject-religion',4,12,'catalog'),
('dinkul','Din Kül.','subject-religion',4,12,'catalog'),
('dinkulturu','Din Kültürü','subject-religion',4,12,'catalog'),
('din','Din','subject-religion',4,12,'catalog'),
('religiousculture','Religious Culture','subject-religion',4,12,'catalog'),
('tcinkilaptarihiveataturkculuk','T.C. İnkılap Tarihi ve Atatürkçülük','subject-inkilap',8,8,'catalog'),
('tcinkilaptarihiveataturkculuk','T.C. İnkılap Tarihi ve Atatürkçülük','subject-inkilap',12,12,'catalog'),
('historyoftheturkishrevolutionandkemalism','History of the Turkish Revolution and Kemalism','subject-inkilap',8,8,'catalog'),
('historyoftheturkishrevolutionandkemalism','History of the Turkish Revolution and Kemalism','subject-inkilap',12,12,'catalog'),
('inkilap','İnkılap','subject-inkilap',8,8,'catalog'),
('inkilap','İnkılap','subject-inkilap',12,12,'catalog'),
('inkilaptarihi','İnkılap Tarihi','subject-inkilap',8,8,'catalog'),
('inkilaptarihi','İnkılap Tarihi','subject-inkilap',12,12,'catalog'),
('inktar','İnk. Tar.','subject-inkilap',8,8,'catalog'),
('inktar','İnk. Tar.','subject-inkilap',12,12,'catalog'),
('tcinkilap','TC İnkılap','subject-inkilap',8,8,'catalog'),
('tcinkilap','TC İnkılap','subject-inkilap',12,12,'catalog'),
('tcink','T.C. İnk.','subject-inkilap',8,8,'catalog'),
('tcink','T.C. İnk.','subject-inkilap',12,12,'catalog'),
('ita','İTA','subject-inkilap',8,8,'catalog'),
('ita','İTA','subject-inkilap',12,12,'catalog'),
('ataturkculuk','Atatürkçülük','subject-inkilap',8,8,'catalog'),
('ataturkculuk','Atatürkçülük','subject-inkilap',12,12,'catalog'),
('bedenegitimi','Beden Eğitimi','subject-pe',1,12,'catalog'),
('physicaleducation','Physical Education','subject-pe',1,12,'catalog'),
('beden','Beden','subject-pe',1,12,'catalog'),
('bed','BED','subject-pe',1,12,'catalog'),
('bedegt','Bed. Eğt.','subject-pe',1,12,'catalog'),
('bedenegitimiveoyun','Beden Eğitimi ve Oyun','subject-pe',1,12,'catalog'),
('bedenegitimivespor','Beden Eğitimi ve Spor','subject-pe',1,12,'catalog'),
('beo','BEO','subject-pe',1,12,'catalog'),
('bes','BES','subject-pe',1,12,'catalog'),
('oyunvefizikietkinlikler','Oyun ve Fiziki Etkinlikler','subject-pe',1,12,'catalog'),
('pe','PE','subject-pe',1,12,'catalog'),
('spor','Spor','subject-pe',1,12,'catalog'),
('sporvefizikietkinlikler','Spor ve Fizikî Etkinlikler','subject-pe',1,12,'catalog'),
('sporegitimi','Spor Eğitimi','subject-pe',1,12,'catalog'),
('gorselsanatlar','Görsel Sanatlar','subject-visual-arts',1,12,'catalog'),
('visualarts','Visual Arts','subject-visual-arts',1,12,'catalog'),
('gorsels','Görsel S.','subject-visual-arts',1,12,'catalog'),
('gorsan','Gör. San.','subject-visual-arts',1,12,'catalog'),
('gs','GS','subject-visual-arts',1,12,'catalog'),
('gor','GÖR','subject-visual-arts',1,12,'catalog'),
('resim','Resim','subject-visual-arts',1,12,'catalog'),
('resimis','Resim-İş','subject-visual-arts',1,12,'catalog'),
('sanat','Sanat','subject-visual-arts',1,12,'catalog'),
('art','Art','subject-visual-arts',1,12,'catalog'),
('sanategitimi','Sanat Eğitimi','subject-visual-arts',1,12,'catalog'),
('dijitalsanatlar','Dijital Sanatlar','subject-visual-arts',1,12,'catalog'),
('muzik','Müzik','subject-music',1,12,'catalog'),
('music','Music','subject-music',1,12,'catalog'),
('muz','MÜZ','subject-music',1,12,'catalog'),
('bilisimteknolojileriveyazilim','Bilişim Teknolojileri ve Yazılım','subject-ict',5,6,'catalog'),
('bilisimteknolojileriveyazilim','Bilişim Teknolojileri ve Yazılım','subject-ict',9,12,'catalog'),
('ictandsoftware','ICT and Software','subject-ict',5,6,'catalog'),
('ictandsoftware','ICT and Software','subject-ict',9,12,'catalog'),
('bilisim','Bilişim','subject-ict',5,6,'catalog'),
('bilisim','Bilişim','subject-ict',9,12,'catalog'),
('bilisimtek','Bilişim Tek.','subject-ict',5,6,'catalog'),
('bilisimtek','Bilişim Tek.','subject-ict',9,12,'catalog'),
('bty','BTY','subject-ict',5,6,'catalog'),
('bty','BTY','subject-ict',9,12,'catalog'),
('bt','BT','subject-ict',5,6,'catalog'),
('bt','BT','subject-ict',9,12,'catalog'),
('biltek','Bil. Tek.','subject-ict',5,6,'catalog'),
('biltek','Bil. Tek.','subject-ict',9,12,'catalog'),
('bilgisayar','Bilgisayar','subject-ict',5,6,'catalog'),
('bilgisayar','Bilgisayar','subject-ict',9,12,'catalog'),
('ict','ICT','subject-ict',5,6,'catalog'),
('ict','ICT','subject-ict',9,12,'catalog'),
('computer','Computer','subject-ict',5,6,'catalog'),
('computer','Computer','subject-ict',9,12,'catalog'),
('yazilim','Yazılım','subject-ict',5,6,'catalog'),
('yazilim','Yazılım','subject-ict',9,12,'catalog'),
('kodlama','Kodlama','subject-ict',5,6,'catalog'),
('kodlama','Kodlama','subject-ict',9,12,'catalog'),
('robotikkodlama','Robotik Kodlama','subject-ict',5,6,'catalog'),
('robotikkodlama','Robotik Kodlama','subject-ict',9,12,'catalog'),
('yapayzekauygulamalari','Yapay Zekâ Uygulamaları','subject-ict',5,6,'catalog'),
('yapayzekauygulamalari','Yapay Zekâ Uygulamaları','subject-ict',9,12,'catalog'),
('teknolojivetasarim','Teknoloji ve Tasarım','subject-technology-design',7,8,'catalog'),
('technologyanddesign','Technology and Design','subject-technology-design',7,8,'catalog'),
('teknolojitasarim','Teknoloji Tasarım','subject-technology-design',7,8,'catalog'),
('tektas','Tek. Tas.','subject-technology-design',7,8,'catalog'),
('tt','TT','subject-technology-design',7,8,'catalog'),
('tasarim','Tasarım','subject-technology-design',7,8,'catalog'),
('trafikguvenligi','Trafik Güvenliği','subject-traffic',4,4,'catalog'),
('trafficsafety','Traffic Safety','subject-traffic',4,4,'catalog'),
('trafik','Trafik','subject-traffic',4,4,'catalog'),
('trfguv','Trf. Güv.','subject-traffic',4,4,'catalog'),
('saglikbilgisivetrafikkulturu','Sağlık Bilgisi ve Trafik Kültürü','subject-health-traffic',9,9,'catalog'),
('healthandtrafficculture','Health and Traffic Culture','subject-health-traffic',9,9,'catalog'),
('saglikbilgisi','Sağlık Bilgisi','subject-health-traffic',9,9,'catalog'),
('sbtk','SBTK','subject-health-traffic',9,9,'catalog'),
('sagbil','Sağ. Bil.','subject-health-traffic',9,9,'catalog'),
('trafikkulturu','Trafik Kültürü','subject-health-traffic',9,9,'catalog'),
('insanhaklarivatandaslikvedemokrasi','İnsan Hakları, Vatandaşlık ve Demokrasi','subject-rights',4,4,'catalog'),
('humanrightscitizenshipanddemocracy','Human Rights, Citizenship and Democracy','subject-rights',4,4,'catalog'),
('insanhaklari','İnsan Hakları','subject-rights',4,4,'catalog'),
('vatandaslik','Vatandaşlık','subject-rights',4,4,'catalog'),
('ihvd','İHVD','subject-rights',4,4,'catalog'),
('vatandaslikvedemokrasi','Vatandaşlık ve Demokrasi','subject-rights',4,4,'catalog'),
('demokrasiveinsanhaklari','Demokrasi ve İnsan Hakları','subject-rights',4,4,'catalog'),
('rehberlikveyonlendirme','Rehberlik ve Yönlendirme','subject-guidance',5,12,'catalog'),
('guidance','Guidance','subject-guidance',5,12,'catalog'),
('rehberlik','Rehberlik','subject-guidance',5,12,'catalog'),
('reh','REH','subject-guidance',5,12,'catalog'),
('rehberlikvekariyerplanlama','Rehberlik ve Kariyer Planlama','subject-guidance',5,12,'catalog'),
('sinifrehberligi','Sınıf Rehberliği','subject-guidance',5,12,'catalog'),
('serbestetkinlikler','Serbest Etkinlikler','subject-free-activities',1,3,'catalog'),
('freeactivities','Free Activities','subject-free-activities',1,3,'catalog'),
('serbestetk','Serbest Etk.','subject-free-activities',1,3,'catalog'),
('se','SE','subject-free-activities',1,3,'catalog'),
('serbestzaman','Serbest Zaman','subject-free-activities',1,3,'catalog'),
('etkinlik','Etkinlik','subject-free-activities',1,3,'catalog'),
('turkdiliveedebiyati','Türk Dili ve Edebiyatı','subject-literature',9,12,'catalog'),
('turkishlanguageandliterature','Turkish Language and Literature','subject-literature',9,12,'catalog'),
('tde','TDE','subject-literature',9,12,'catalog'),
('edebiyat','Edebiyat','subject-literature',9,12,'catalog'),
('edb','EDB','subject-literature',9,12,'catalog'),
('turkdili','Türk Dili','subject-literature',9,12,'catalog'),
('dilveanlatim','Dil ve Anlatım','subject-literature',9,12,'catalog'),
('turkedebiyati','Türk Edebiyatı','subject-literature',9,12,'catalog'),
('literature','Literature','subject-literature',9,12,'catalog'),
('secmeliturkdiliveedebiyati','Seçmeli Türk Dili ve Edebiyatı','subject-literature',9,12,'catalog'),
('metintahlilleri','Metin Tahlilleri','subject-literature',9,12,'catalog'),
('fizik','Fizik','subject-physics',9,12,'catalog'),
('physics','Physics','subject-physics',9,12,'catalog'),
('fiz','FİZ','subject-physics',9,12,'catalog'),
('secmelifizik','Seçmeli Fizik','subject-physics',9,12,'catalog'),
('kimya','Kimya','subject-chemistry',9,12,'catalog'),
('chemistry','Chemistry','subject-chemistry',9,12,'catalog'),
('kim','KİM','subject-chemistry',9,12,'catalog'),
('secmelikimya','Seçmeli Kimya','subject-chemistry',9,12,'catalog'),
('biyoloji','Biyoloji','subject-biology',9,12,'catalog'),
('biology','Biology','subject-biology',9,12,'catalog'),
('biy','BİY','subject-biology',9,12,'catalog'),
('bio','Bio','subject-biology',9,12,'catalog'),
('secmelibiyoloji','Seçmeli Biyoloji','subject-biology',9,12,'catalog'),
('tarih','Tarih','subject-history',9,12,'catalog'),
('history','History','subject-history',9,12,'catalog'),
('tar','TAR','subject-history',9,12,'catalog'),
('secmelitarih','Seçmeli Tarih','subject-history',9,12,'catalog'),
('cagdasturkvedunyatarihi','Çağdaş Türk ve Dünya Tarihi','subject-history',9,12,'catalog'),
('ctdt','ÇTDT','subject-history',9,12,'catalog'),
('ortakturktarihi','Ortak Türk Tarihi','subject-history',9,12,'catalog'),
('cografya','Coğrafya','subject-geography',9,12,'catalog'),
('geography','Geography','subject-geography',9,12,'catalog'),
('cog','COĞ','subject-geography',9,12,'catalog'),
('secmelicografya','Seçmeli Coğrafya','subject-geography',9,12,'catalog'),
('turkdunyasicografyasi','Türk Dünyası Coğrafyası','subject-geography',9,12,'catalog'),
('felsefe','Felsefe','subject-philosophy',10,12,'catalog'),
('philosophy','Philosophy','subject-philosophy',10,12,'catalog'),
('fel','FEL','subject-philosophy',10,12,'catalog'),
('mantik','Mantık','subject-philosophy',10,12,'catalog'),
('psikoloji','Psikoloji','subject-philosophy',10,12,'catalog'),
('sosyoloji','Sosyoloji','subject-philosophy',10,12,'catalog'),
('felsefegrubu','Felsefe Grubu','subject-philosophy',10,12,'catalog'),
('sosyalbilimcalismalari','Sosyal Bilim Çalışmaları','subject-social-science-studies',9,12,'catalog'),
('socialsciencestudies','Social Science Studies','subject-social-science-studies',9,12,'catalog'),
('sbc','SBÇ','subject-social-science-studies',9,12,'catalog'),
('sosyalbilimler','Sosyal Bilimler','subject-social-science-studies',9,12,'catalog'),
('kuranikerim','Kur''an-ı Kerim','subject-quran',5,12,'catalog'),
('quran','Quran','subject-quran',5,12,'catalog'),
('kuran','Kuran','subject-quran',5,12,'catalog'),
('kk','KK','subject-quran',5,12,'catalog'),
('peygamberimizinhayati','Peygamberimizin Hayatı','subject-prophet-life',5,12,'catalog'),
('lifeoftheprophet','Life of the Prophet','subject-prophet-life',5,12,'catalog'),
('siyer','Siyer','subject-prophet-life',5,12,'catalog'),
('ph','PH','subject-prophet-life',5,12,'catalog'),
('peyghay','Peyg. Hay.','subject-prophet-life',5,12,'catalog'),
('temeldinibilgiler','Temel Dinî Bilgiler','subject-basic-religious',5,12,'catalog'),
('basicreligiousknowledge','Basic Religious Knowledge','subject-basic-religious',5,12,'catalog'),
('tdb','TDB','subject-basic-religious',5,12,'catalog'),
('secmelidersdiger','Seçmeli ders (diğer)','subject-elective-other',1,12,'catalog'),
('electiveother','Elective (other)','subject-elective-other',1,12,'catalog'),
('secmeli','Seçmeli','subject-elective-other',1,12,'catalog'),
('sec','Seç.','subject-elective-other',1,12,'catalog'),
('secmeliders','Seçmeli Ders','subject-elective-other',1,12,'catalog'),
('elective','Elective','subject-elective-other',1,12,'catalog'),
('okumabecerileri','Okuma Becerileri','subject-elective-other',1,12,'catalog'),
('yazarlikveyazmabecerileri','Yazarlık ve Yazma Becerileri','subject-elective-other',1,12,'catalog'),
('matematikvebilimuygulamalari','Matematik ve Bilim Uygulamaları','subject-elective-other',1,12,'catalog'),
('cevreegitimiveiklimdegisikligi','Çevre Eğitimi ve İklim Değişikliği','subject-elective-other',1,12,'catalog'),
('sehrimiz','Şehrimiz','subject-elective-other',1,12,'catalog'),
('hukukveadalet','Hukuk ve Adalet','subject-elective-other',1,12,'catalog'),
('dusunmeegitimi','Düşünme Eğitimi','subject-elective-other',1,12,'catalog'),
('projetasarimiveuygulamalari','Proje Tasarımı ve Uygulamaları','subject-elective-other',1,12,'catalog'),
('okultemellisosyalsorumlulukcalismalari','Okul Temelli Sosyal Sorumluluk Çalışmaları','subject-elective-other',1,12,'catalog'),
('medyaokuryazarligi','Medya Okuryazarlığı','subject-elective-other',1,12,'catalog'),
('afetbilinci','Afet Bilinci','subject-elective-other',1,12,'catalog'),
('temelyasambecerileri','Temel Yaşam Becerileri','subject-elective-other',1,12,'catalog'),
('turksosyalhayatindaaile','Türk Sosyal Hayatında Aile','subject-elective-other',1,12,'catalog'),
('kulturvemedeniyetimizeyonverenler','Kültür ve Medeniyetimize Yön Verenler','subject-elective-other',1,12,'catalog'),
('ahlakvevatandaslikegitimi','Ahlak ve Vatandaşlık Eğitimi','subject-elective-other',1,12,'catalog'),
('gorgukurallarivenezaket','Görgü Kuralları ve Nezaket','subject-elective-other',1,12,'catalog'),
('oyunveoyunetkinlikleri','Oyun ve Oyun Etkinlikleri','subject-elective-other',1,12,'catalog'),
('masalvedestanlarimiz','Masal ve Destanlarımız','subject-elective-other',1,12,'catalog'),
('gelenekselsanatlar','Geleneksel Sanatlar','subject-elective-other',1,12,'catalog'),
('halkoyunlari','Halk Oyunları','subject-elective-other',1,12,'catalog'),
('yasayandillervelehceler','Yaşayan Diller ve Lehçeler','subject-elective-other',1,12,'catalog'),
('astronomiveuzaybilimleri','Astronomi ve Uzay Bilimleri','subject-elective-other',1,12,'catalog'),
('girisimcilik','Girişimcilik','subject-elective-other',1,12,'catalog'),
('osmanliturkcesi','Osmanlı Türkçesi','subject-elective-other',1,12,'catalog'),
('hedeftemellidestekegitimi','Hedef Temelli Destek Eğitimi','subject-elective-other',1,12,'catalog'),
('htde','HTDE','subject-elective-other',1,12,'catalog'),
('fen','Fen','subject-physics',9,12,'policy_ambiguity'),
('fen','Fen','subject-chemistry',9,12,'policy_ambiguity'),
('fen','Fen','subject-biology',9,12,'policy_ambiguity'),
('din','Din','subject-quran',5,12,'policy_ambiguity'),
('din','Din','subject-prophet-life',5,12,'policy_ambiguity'),
('din','Din','subject-basic-religious',5,12,'policy_ambiguity'),
('yabancidil','Yabancı Dil','subject-german',2,12,'policy_ambiguity'),
('yabancidil','Yabancı Dil','subject-french',2,12,'policy_ambiguity'),
('ikinciyabancidil','İkinci Yabancı Dil','subject-french',5,12,'policy_ambiguity'),
('sosyal','Sosyal','subject-social-science-studies',9,12,'policy_ambiguity'),
('trafik','Trafik','subject-health-traffic',9,9,'policy_ambiguity'),
('inkilap','İnkılap','subject-history',9,11,'policy_ambiguity')
on conflict do nothing;
-- END GENERATED subject-catalog

create function public.suggest_subject(p_text text,p_grade int default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare normalized text;cands jsonb;in_scope int;total int;begin
 if not (gina.is_parent() or gina.has_operation_role('content')) then raise exception 'subject_forbidden' using errcode='42501';end if;
 if p_text is null or length(p_text)>80 or (p_grade is not null and p_grade not between 0 and 12) then raise exception 'subject_invalid';end if;
 normalized:=gina.normalize_subject_alias(p_text);
 with hits as (
  select o.id,o.label_tr,o.label_en,o.min_grade,o.max_grade,o.position,
   bool_or(p_grade is not null and p_grade between s.grade_min and s.grade_max) scoped,
   min(s.alias) alias
  from gina.subject_synonyms s join public.guided_input_options o on o.id=s.subject_id and o.kind='subject' and o.active
  where normalized<>'' and s.alias_normalized=normalized group by o.id
 ), counted as (select *,count(*) filter(where scoped) over() n_scoped from hits)
 select coalesce(jsonb_agg(jsonb_build_object('subject_id',id,'label_tr',label_tr,'label_en',label_en,'grade_min',min_grade,'grade_max',max_grade,
   'in_grade_scope',scoped,'matched_alias',alias) order by scoped desc,position,id) filter(where scoped or n_scoped=0),'[]'),
  coalesce(max(n_scoped),0),count(*)
 into cands,in_scope,total from counted;
 -- Sınıf kapsamı yalnız daraltır; kapsam dışı aday engellenmez, not ile önerilir.
 return jsonb_build_object('input',p_text,'normalized',normalized,'grade',p_grade,
  'match',case jsonb_array_length(cands) when 0 then 'none' when 1 then 'single' else 'ambiguous' end,
  'requires_confirmation',true,'keep_label',true,
  'scope_note',total>0 and in_scope=0 and p_grade is not null,
  'candidates',cands);
end;$$;

create function public.admin_subject_synonyms() returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('subject_id',subject_id,'alias',alias,'alias_normalized',alias_normalized,
  'grade_min',grade_min,'grade_max',grade_max,'source',source) order by subject_id,source,alias_normalized,grade_min),'[]') from gina.subject_synonyms);
end;$$;

-- Kaynaklı takvim tohumu (docs/learning/catalog/education-calendars/*.json, şema gina.education-calendar-seed.v1).
-- p_execute=false: yazmaz, önizleme döndürür. p_execute=true: yalnız eksik taslakları oluşturur; var olan takvime
-- (taslak ya da yayımlanmış) dokunmaz, hiçbir şeyi yayımlamaz. Aynı istek kimliği tekrarında aynı sonuç döner.
create function public.admin_import_education_calendar_seed(p_request uuid,p_seed jsonb,p_execute boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare rec jsonb;stage_value jsonb;st text;yr int;v jsonb;act text;why text;place_kind text;v_parent uuid;v_place uuid;place_state text;
 created_place boolean;new_id uuid;records jsonb:='[]';n_create int:=0;n_exists int:=0;n_skip int:=0;n_invalid int:=0;n_places int:=0;
 payload jsonb;result jsonb;sources jsonb;begin
 if not gina.has_operation_role('content') then raise exception 'forbidden' using errcode='42501';end if;
 if p_execute is null or p_seed is null or jsonb_typeof(p_seed)<>'object' or p_seed->>'schema' is distinct from 'gina.education-calendar-seed.v1'
 or octet_length(p_seed::text)>262144 or jsonb_typeof(p_seed->'calendars') is distinct from 'array' or jsonb_array_length(p_seed->'calendars') not between 1 and 200
 or jsonb_typeof(p_seed->'academic_year') is distinct from 'number' or (p_seed->>'academic_year')::numeric not between 2000 and 2100 then raise exception 'calendar_seed_invalid';end if;
 yr:=(p_seed->>'academic_year')::int;
 if p_execute then
  payload:=jsonb_build_object('action','education.calendar.seed','seed',encode(extensions.digest(p_seed::text,'sha256'),'hex'));
  result:=gina.help_receipt(p_request,payload);if result is not null then return result;end if;
  perform pg_advisory_xact_lock(608005);
 end if;
 for rec in select value from jsonb_array_elements(p_seed->'calendars') loop
  place_kind:=rec->'place'->>'kind';v_place:=null;v_parent:=null;place_state:='invalid';created_place:=false;
  if place_kind='country' then
   select p.id into v_place from gina.education_places p where p.kind='country'
    and (p.id::text=rec->'place'->>'existing_place_id' or lower(p.name)=lower(rec->'place'->>'name')) order by p.id::text=rec->'place'->>'existing_place_id' desc limit 1;
   place_state:=case when v_place is null then 'missing' else 'existing' end;
  elsif place_kind='region' then
   select p.id into v_parent from gina.education_places p where p.kind='country' and lower(p.name)=lower(rec->'place'->>'parent') limit 1;
   if v_parent is not null and length(trim(coalesce(rec->'place'->>'name',''))) between 2 and 120 then
    select p.id,case when p.kind<>'region' then 'invalid' when p.active then 'existing' else 'existing_inactive' end into v_place,place_state
     from gina.education_places p where p.parent_id=v_parent and lower(p.name)=lower(trim(rec->'place'->>'name'));
    if v_place is null then place_state:='create_inactive';end if;
   end if;
  end if; -- Okul kaydı tohumdan açılmaz (uydurma okul listesi yasağı): place_state 'invalid' kalır.
  for stage_value in select value from jsonb_array_elements(case jsonb_typeof(rec->'stage') when 'array' then rec->'stage' else jsonb_build_array(rec->'stage') end) loop
   st:=stage_value#>>'{}';v:=rec->'calendar_value';act:='create';why:=null;
   if rec->>'confidence' is distinct from 'high' and rec->>'confidence' is distinct from 'medium' then act:='skip';why:='low_confidence';
   elsif v is null or jsonb_typeof(v)<>'object' then act:='skip';why:='no_calendar_value';
   elsif st is null or st not in('preschool','primary','middle','high','university') or (rec->>'academic_year') is distinct from yr::text then act:='invalid';why:='scope';
   elsif place_state in('invalid','missing') then act:='invalid';why:='place';
   else
    begin
     perform gina.validate_education_calendar(v);
     if extract(year from (v->>'starts_on')::date)::int<>yr then raise exception 'calendar_invalid';end if;
    exception when others then act:='invalid';why:='calendar_value';
    end;
   end if;
   if act='create' and v_place is not null and exists(select 1 from gina.education_calendars c where c.place_id=v_place and c.stage=st and c.academic_year=yr) then act:='exists';end if;
   new_id:=null;
   if act='create' and p_execute then
    if v_place is null then
     v_place:=gen_random_uuid();
     insert into gina.education_places(id,kind,parent_id,name,active) values(v_place,'region',v_parent,trim(rec->'place'->>'name'),false);
     insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'education.place.seed','education_places',v_place::text,
      jsonb_build_object('seed_id',rec->>'id','name',trim(rec->'place'->>'name'),'active',false));
     created_place:=true;n_places:=n_places+1;
    end if;
    new_id:=gen_random_uuid();
    insert into gina.education_calendars(id,place_id,stage,academic_year,draft) values(new_id,v_place,st,yr,v);
    insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'education.calendar.draft','education_calendars',new_id::text,
     jsonb_build_object('source','seed','seed_id',rec->>'id','source_url',v->>'source_url','verified_on',v->>'verified_on','checked_at',rec->>'checked_at','confidence',rec->>'confidence','publish',false));
   elsif act='create' and v_place is null and not created_place then
    n_places:=n_places+1;created_place:=true; -- önizlemede aynı il bir kez sayılır
   end if;
   if act='create' then n_create:=n_create+1;elsif act='exists' then n_exists:=n_exists+1;elsif act='skip' then n_skip:=n_skip+1;else n_invalid:=n_invalid+1;end if;
   records:=records||jsonb_build_object('seed_id',rec->>'id','place_kind',place_kind,'place_name',rec->'place'->>'name','place_state',place_state,
    'stage',st,'academic_year',yr,'confidence',rec->>'confidence','action',act,'reason',why,'calendar_id',new_id,
    'title',v->>'title','source_url',coalesce(v->>'source_url',rec->>'source_url'),'verified_on',v->>'verified_on','checked_at',rec->>'checked_at',
    'published_at',rec->>'published_at','terms',case when jsonb_typeof(v->'terms')='array' then jsonb_array_length(v->'terms') else 0 end,
    'starts_on',v->>'starts_on','ends_on',v->>'ends_on');
  end loop;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',s->>'id','title',left(s->>'title',300),'url',s->>'url','published_at',s->>'published_at','accessed_at',s->>'accessed_at')),'[]')
  into sources from jsonb_array_elements(case jsonb_typeof(p_seed->'sources') when 'array' then p_seed->'sources' else '[]' end) s where coalesce(s->>'url','') ~ '^https://';
 result:=jsonb_build_object('executed',p_execute,'published',false,'academic_year',yr,'checked_at',p_seed->>'checked_at',
  'counts',jsonb_build_object('create',n_create,'exists',n_exists,'skipped',n_skip,'invalid',n_invalid,'new_places',n_places),
  'records',records,'sources',sources);
 if p_execute then
  perform gina.save_help_receipt(p_request,payload,result,null);
  insert into public.audit_log(actor_id,action,target_table,target_id,details) values(auth.uid(),'education.calendar.seed_import','education_calendars',null,
   payload||jsonb_build_object('counts',result->'counts'));
 end if;
 return result;
end;$$;

revoke all on function gina.normalize_subject_alias(text) from public,anon,authenticated,service_role;
revoke all on function public.suggest_subject(text,int),public.admin_subject_synonyms(),public.admin_import_education_calendar_seed(uuid,jsonb,boolean) from public,anon,service_role;
grant execute on function public.suggest_subject(text,int),public.admin_subject_synonyms(),public.admin_import_education_calendar_seed(uuid,jsonb,boolean) to authenticated;
