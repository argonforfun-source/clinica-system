/**
 * ARGON MEDICAL OS — Dental Official Procedure Catalog
 * specialty-modules/dental_procedure_catalog.js — v1.0
 *
 * Source: official dental fee-schedule provided by the clinic
 * ("لائحة الأجور للمعالجة السنية"). All procedure codes and Arabic
 * names below are transcribed VERBATIM from that source, including
 * any spelling irregularities in the original text. Do not "correct"
 * or reword canonicalName — see argon-governance: canonical source
 * text is preserved exactly, customization happens in a separate
 * display layer (dental_label_registry.js), never here.
 *
 * This file is additive: it does not modify, replace, or read from
 * TOOTH_STATUSES / SURFACE_CONDITIONS in dental_chart_module.js.
 * Those remain the clinical CONDITION layer. This file is the
 * separate PROCEDURE layer (see master spec, section 16).
 *
 * Total entries: 128 (verified — see PROCEDURE_CATALOG_VERIFICATION.md)
 */
(function (global) {
  'use strict';

  // ─── Categories (ordered as in the source document) ───
  var CATEGORIES = [
    { key: 'diagnosis_general', nameAr: 'التشخيص العام', nameEn: 'GENERAL DIAGNOSIS' },
    { key: 'radiology', nameAr: 'الاشعة', nameEn: 'RADIOLOGY' },
    { key: 'conservative', nameAr: 'المعالجة التحفظية', nameEn: 'CONSERVATIVE TREATMENT' },
    { key: 'endodontic', nameAr: 'المعالجة اللبية', nameEn: 'ENDODONTIC TREATMENT' },
    { key: 'whitening', nameAr: 'تبيض الأسنان', nameEn: 'TEETH WHITENING' },
    { key: 'fixed_prosthodontics', nameAr: 'الاستعاضات السنية الثابتة', nameEn: 'FIXED PROSTHODONTICS' },
    { key: 'removable_prosthodontics', nameAr: 'الاستعاضات المتحركة', nameEn: 'REMOVABLE PROSTHODONTICS' },
    { key: 'implants', nameAr: 'زرع الاسنان', nameEn: 'DENTAL IMPLANTS' },
    { key: 'periodontics', nameAr: 'معالجة اللثة', nameEn: 'PERIODONTICS' },
    { key: 'oral_medicine', nameAr: 'طب الفم', nameEn: 'ORAL MEDICINE' },
    { key: 'surgery', nameAr: 'الجراحة', nameEn: 'SURGERY' },
  ];

  // ─── The 128 official procedures ───
  // Fields: code, category, nameAr (canonical, verbatim from source),
  // priceMinJOD, priceMaxJOD (null when the source gives a compound/
  // irregular price instead of a single min-max pair — see priceNote),
  // priceNote (only present for irregular rows, e.g. 16-16).
  var PROCEDURES = [
    {
      code: '10-10', category: 'diagnosis_general',
      nameAr: 'فحص الفم كاملا – الكشفية',
      priceMinJOD: 3, priceMaxJOD: 10,
      priceNote: 'عام 3-6 / اختصاصي 5-10'
    },
    {
      code: '10-11', category: 'diagnosis_general',
      nameAr: 'زيارة ليلية طارئة',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: 'عام 10-15 / اختصاصي 15-20'
    },
    {
      code: '10-12', category: 'diagnosis_general',
      nameAr: 'زيارة للمستشفى بناء على طلب المريض',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: 'عام 10-15 / اختصاصي 15-20'
    },
    {
      code: '10-13', category: 'diagnosis_general',
      nameAr: 'تقرير طبي',
      priceMinJOD: 5, priceMaxJOD: 15,
      priceNote: 'عام 5-10 / اختصاصي 10-15'
    },
    {
      code: '10-14', category: 'radiology',
      nameAr: 'صوره شعاعية صغيره داخل الفم',
      priceMinJOD: 3, priceMaxJOD: 5,
      priceNote: null
    },
    {
      code: '10-15', category: 'radiology',
      nameAr: 'صورة طباقية',
      priceMinJOD: 5, priceMaxJOD: 8,
      priceNote: null
    },
    {
      code: '10-16', category: 'radiology',
      nameAr: 'صورة بانوراما',
      priceMinJOD: 8, priceMaxJOD: 12,
      priceNote: null
    },
    {
      code: '10-17', category: 'radiology',
      nameAr: 'صورة جانبية لكامل الوجه/\nاو صورة الرأس القياسية',
      priceMinJOD: 10, priceMaxJOD: 12,
      priceNote: null
    },
    {
      code: '10-18', category: 'radiology',
      nameAr: 'صورة اشعة بالكمبيوتر( (CDR',
      priceMinJOD: 5, priceMaxJOD: 10,
      priceNote: null
    },
    {
      code: '11-10', category: 'conservative',
      nameAr: 'حشوه فضية على سطح واحد من السن',
      priceMinJOD: 6, priceMaxJOD: 12,
      priceNote: null
    },
    {
      code: '11-11', category: 'conservative',
      nameAr: 'حشوه فضية على سطحين من السن',
      priceMinJOD: 8, priceMaxJOD: 15,
      priceNote: null
    },
    {
      code: '11-12', category: 'conservative',
      nameAr: 'حشوة فضية على ثلاث اسطح من السن',
      priceMinJOD: 8, priceMaxJOD: 12,
      priceNote: null
    },
    {
      code: '11-13', category: 'conservative',
      nameAr: 'حشوة كمبوزيت على سطح واحد من السن',
      priceMinJOD: 12, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '11-14', category: 'conservative',
      nameAr: 'حشوة كمبوزيت على سطحين من السن',
      priceMinJOD: 15, priceMaxJOD: 25,
      priceNote: null
    },
    {
      code: '11-15', category: 'conservative',
      nameAr: 'حشوة كمبوزيت علة ثلاث اسطح',
      priceMinJOD: 20, priceMaxJOD: 35,
      priceNote: null
    },
    {
      code: '11-16', category: 'conservative',
      nameAr: 'دبوس معدني مثبت',
      priceMinJOD: 3, priceMaxJOD: 8,
      priceNote: null
    },
    {
      code: '11-17', category: 'conservative',
      nameAr: 'تغليف وجه سن امامي من مادة الكمبوزيت\n/ الوحدة سن',
      priceMinJOD: 25, priceMaxJOD: 35,
      priceNote: null
    },
    {
      code: '11-18', category: 'conservative',
      nameAr: 'حشوه زجاجيه من مادة الايونومر  على سطح واحد',
      priceMinJOD: 8, priceMaxJOD: 12,
      priceNote: null
    },
    {
      code: '11-19', category: 'conservative',
      nameAr: 'حشوه زجاجيه من مادة الايونومر  على\nسطحين',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '11-20', category: 'conservative',
      nameAr: 'حشوه زجاجيه من مادة الايونومر  على\nثلاث اسطح',
      priceMinJOD: 15, priceMaxJOD: 25,
      priceNote: null
    },
    {
      code: '11-21', category: 'conservative',
      nameAr: 'حشوة ذهب صب / يضاف لها ثمن الذهب',
      priceMinJOD: 40, priceMaxJOD: 80,
      priceNote: null
    },
    {
      code: '11-22', category: 'conservative',
      nameAr: 'حشوة ذهب صب فوق حدبية/ يضاف\nلها ثمن الذهب',
      priceMinJOD: 60, priceMaxJOD: 100,
      priceNote: null
    },
    {
      code: '11-23', category: 'conservative',
      nameAr: 'حشوه زفية بورسلان(Inlay + only )',
      priceMinJOD: 100, priceMaxJOD: 180,
      priceNote: null
    },
    {
      code: '11-24', category: 'conservative',
      nameAr: 'دعامة معدنية داخل قناة السن',
      priceMinJOD: 7, priceMaxJOD: 15,
      priceNote: null
    },
    {
      code: '12-10', category: 'endodontic',
      nameAr: 'المعالجة اللبية مع حشوة القناة لسن بقناة واحدة باستثناء الحشوة الدائمة للتاج',
      priceMinJOD: 15, priceMaxJOD: 30,
      priceNote: null
    },
    {
      code: '12-11', category: 'endodontic',
      nameAr: 'المعالجة اللبية مع حشوة القناتين لسن بقناتين باستثناء الحشوة الدائمة والتاج',
      priceMinJOD: 25, priceMaxJOD: 60,
      priceNote: null
    },
    {
      code: '12-12', category: 'endodontic',
      nameAr: 'المعالجة اللبية مع حشوة القنوات لسن بثلاث قنوات باستثناء الحشوة الدائمة للتاج',
      priceMinJOD: 35, priceMaxJOD: 90,
      priceNote: null
    },
    {
      code: '12-13', category: 'endodontic',
      nameAr: 'اعادة المعالجة اللبية للقناة الواحدة مع حشوة القناة باستثناء الحشوة الدائمة للتاج',
      priceMinJOD: 20, priceMaxJOD: 40,
      priceNote: null
    },
    {
      code: '12-14', category: 'endodontic',
      nameAr: 'اعادة المعالجة اللبية لضرس بقناتين مع حشوة القنوات باستثناء الحشوة الدائمة للتاج',
      priceMinJOD: 35, priceMaxJOD: 80,
      priceNote: null
    },
    {
      code: '12-15', category: 'endodontic',
      nameAr: 'اعادة المعالجة اللبية لضرس بثلاث قنوات مع حشوة القنوات باستثناء الحشوة الدائمة للتاج',
      priceMinJOD: 50, priceMaxJOD: 120,
      priceNote: null
    },
    {
      code: '12-16', category: 'endodontic',
      nameAr: 'اغلاق الذروة بماءات الكالسيوم لكامل العلاج لكل قناة',
      priceMinJOD: 30, priceMaxJOD: 50,
      priceNote: null
    },
    {
      code: '12-17', category: 'endodontic',
      nameAr: 'قطع ذروة الجذر ما عدا حشو القناة للبية الوحدة جذر واحد',
      priceMinJOD: 40, priceMaxJOD: 60,
      priceNote: null
    },
    {
      code: '13-10', category: 'whitening',
      nameAr: 'تبيض سن واحد ,داخلي كيميائيا',
      priceMinJOD: 15, priceMaxJOD: 30,
      priceNote: null
    },
    {
      code: '13-11', category: 'whitening',
      nameAr: 'تبيض الاسنان كيميائيا باستعمال الاجهزة شاملا المواد والاجهزة , لفك واحد',
      priceMinJOD: 80, priceMaxJOD: 120,
      priceNote: null
    },
    {
      code: '14-10', category: 'fixed_prosthodontics',
      nameAr: 'تاج اكريلي مؤقت واحد وكل سن اضافي\n5 دنانير',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '14-11', category: 'fixed_prosthodontics',
      nameAr: 'تاج معدني صب *',
      priceMinJOD: 30, priceMaxJOD: 50,
      priceNote: null
    },
    {
      code: '14-12', category: 'fixed_prosthodontics',
      nameAr: 'التاج الاكريلي المطبوخ',
      priceMinJOD: 20, priceMaxJOD: 30,
      priceNote: null
    },
    {
      code: '14-13', category: 'fixed_prosthodontics',
      nameAr: 'تاج معدني بوجه اكريلي',
      priceMinJOD: 30, priceMaxJOD: 50,
      priceNote: null
    },
    {
      code: '14-14', category: 'fixed_prosthodontics',
      nameAr: 'التاج المبني من البورسلان المتحد بالمعدن *',
      priceMinJOD: 70, priceMaxJOD: 140,
      priceNote: null
    },
    {
      code: '14-15', category: 'fixed_prosthodontics',
      nameAr: 'التاج المبني من البورسلان  بدون معدن\n( التاج الخزفي )',
      priceMinJOD: 140, priceMaxJOD: 200,
      priceNote: null
    },
    {
      code: '14-16', category: 'fixed_prosthodontics',
      nameAr: 'الوجه التجميلي من البورسلان / لكل سن',
      priceMinJOD: 120, priceMaxJOD: 180,
      priceNote: null
    },
    {
      code: '14-17', category: 'fixed_prosthodontics',
      nameAr: 'تاج معدني بوجه بورسلان *',
      priceMinJOD: 60, priceMaxJOD: 100,
      priceNote: null
    },
    {
      code: '14-18', category: 'fixed_prosthodontics',
      nameAr: 'فك تاج قديم / الوحدة سن واحد',
      priceMinJOD: 5, priceMaxJOD: 10,
      priceNote: null
    },
    {
      code: '14-19', category: 'fixed_prosthodontics',
      nameAr: 'فك جسر قديم',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '14-20', category: 'fixed_prosthodontics',
      nameAr: 'اعادة تثبيت تاج جسر قديم',
      priceMinJOD: 5, priceMaxJOD: 15,
      priceNote: null
    },
    {
      code: '14-21', category: 'fixed_prosthodontics',
      nameAr: 'وتد معدني صب للتاج *',
      priceMinJOD: 20, priceMaxJOD: 40,
      priceNote: null
    },
    {
      code: '14-22', category: 'fixed_prosthodontics',
      nameAr: 'الجسر الثابت اللاصق المعوض لسن واحد من البورسلان المبني على المعدن / جسر ميرلاند',
      priceMinJOD: 80, priceMaxJOD: 120,
      priceNote: null
    },
    {
      code: '14-23', category: 'fixed_prosthodontics',
      nameAr: 'التاج المبني من البورسلان مع التيتانيوم',
      priceMinJOD: 150, priceMaxJOD: 200,
      priceNote: null
    },
    {
      code: '15-10', category: 'removable_prosthodontics',
      nameAr: 'جهاز جزئي متحرك مصنوع من الاكريل الحار ويعوض سن واحد مفقودة',
      priceMinJOD: 25, priceMaxJOD: 40,
      priceNote: null
    },
    {
      code: '15-11', category: 'removable_prosthodontics',
      nameAr: 'تعويض عن كل سن اضافية',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '15-12', category: 'removable_prosthodontics',
      nameAr: 'جهاز جزئي متحرك هيكلي من الكوبالت كروم/تقليدي/لكل فك ,\nعند استخدام الوصلات يضاف ثمنها *',
      priceMinJOD: 150, priceMaxJOD: 250,
      priceNote: null
    },
    {
      code: '15-13', category: 'removable_prosthodontics',
      nameAr: 'الطقم الكامل التقليدي المصنوع من الاكريل الحار / لكل فك',
      priceMinJOD: 100, priceMaxJOD: 200,
      priceNote: null
    },
    {
      code: '15-14', category: 'removable_prosthodontics',
      nameAr: 'الطقم الكامل الفوقي لكل فك باستثناء كلفة تحضير الدعامات',
      priceMinJOD: 120, priceMaxJOD: 250,
      priceNote: null
    },
    {
      code: '15-15', category: 'removable_prosthodontics',
      nameAr: 'الطقم الكامل الاكريلي المحتوي على مواد مبطنة لينة دائمة لكل فك',
      priceMinJOD: 140, priceMaxJOD: 225,
      priceNote: null
    },
    {
      code: '15-16', category: 'removable_prosthodontics',
      nameAr: 'الطقم الكامل الذي قاعدته من الكوبالت كروم/لكل فك',
      priceMinJOD: 175, priceMaxJOD: 250,
      priceNote: null
    },
    {
      code: '15-17', category: 'removable_prosthodontics',
      nameAr: 'الطقم الكامل الفوري لكل فك باستثناء الاجراءات الجراحية المرافقة',
      priceMinJOD: 125, priceMaxJOD: 225,
      priceNote: null
    },
    {
      code: '15-18', category: 'removable_prosthodontics',
      nameAr: 'تبطين الطقم الكامل او الجهاز الجزئي  المتحرك بالالكريل الحار لكل فك',
      priceMinJOD: 25, priceMaxJOD: 40,
      priceNote: null
    },
    {
      code: '15-19', category: 'removable_prosthodontics',
      nameAr: 'استبدال قاعدة الطقم الكامل المفرد او الجهاز الجزئي المتحرك',
      priceMinJOD: 30, priceMaxJOD: 50,
      priceNote: null
    },
    {
      code: '15-20', category: 'removable_prosthodontics',
      nameAr: 'استخدام مهيئات الانسجة / المواد المبطنة اللينة المؤقتة لكل فك',
      priceMinJOD: 20, priceMaxJOD: 30,
      priceNote: null
    },
    {
      code: '15-21', category: 'removable_prosthodontics',
      nameAr: 'رفع العضة المرحلي للاطقم قديمة',
      priceMinJOD: 15, priceMaxJOD: 25,
      priceNote: null
    },
    {
      code: '15-22', category: 'removable_prosthodontics',
      nameAr: 'اصلاح جهاز متحرك اكريلي مع دون الحاجة لاخذ قياسات',
      priceMinJOD: 5, priceMaxJOD: 15,
      priceNote: null
    },
    {
      code: '15-23', category: 'removable_prosthodontics',
      nameAr: 'اصلاح جهاز متحرك اكريلي مع اخذ قياسات',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '15-24', category: 'removable_prosthodontics',
      nameAr: 'الواقي الليلي للفك العلوي او السفلي',
      priceMinJOD: 50, priceMaxJOD: 80,
      priceNote: null
    },
    {
      code: '15-25', category: 'removable_prosthodontics',
      nameAr: 'الجهاز الوجهي الفكي الفوري داخل الفموي المعوض للانسجة المستأصلة جراحيا',
      priceMinJOD: 200, priceMaxJOD: 250,
      priceNote: null
    },
    {
      code: '15-26', category: 'removable_prosthodontics',
      nameAr: 'الجهاز الوجهي الفكي الفوري داخل الفموي المعوض للانسجه المفقودة / كوبالت كروم',
      priceMinJOD: 350, priceMaxJOD: 400,
      priceNote: null
    },
    {
      code: '15-27', category: 'removable_prosthodontics',
      nameAr: 'الجهاز الوجهي الفكي الفوري خارج الفموي المعوض للاجزاء المستأصلة جراحيا',
      priceMinJOD: 350, priceMaxJOD: 400,
      priceNote: null
    },
    {
      code: '16-10', category: 'implants',
      nameAr: 'الزرعات السنية / دراسة الحالة',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '16-11', category: 'implants',
      nameAr: 'الزراعة تحت السمحاقية للفك الواحد',
      priceMinJOD: 450, priceMaxJOD: 600,
      priceNote: null
    },
    {
      code: '16-12', category: 'implants',
      nameAr: 'الزراعة تحت السمحاقية / الاستعاضة النهائية طقم كامل فوقي مفرد لكل فك',
      priceMinJOD: 150, priceMaxJOD: 250,
      priceNote: null
    },
    {
      code: '16-13', category: 'implants',
      nameAr: 'الزراعة  داخل العظم / وضع الغرسات / لكل غرسة بدون الدعامة',
      priceMinJOD: 300, priceMaxJOD: 500,
      priceNote: null
    },
    {
      code: '16-15', category: 'implants',
      nameAr: 'الزراعة داخل العظم / الدعامة فقط / و يضاف ثمن التاج حسب نوعه',
      priceMinJOD: 100, priceMaxJOD: 200,
      priceNote: null
    },
    {
      code: '16-16', category: 'implants',
      nameAr: 'يضاف:\nفي حالة تسميك عظم الفك ( ماعدا ثمن المواد ) في حالة التمسيك مع استعمال الاغشية الموجهة ( ماعدا ثمن المواد المستعملة لذلك )',
      priceMinJOD: null, priceMaxJOD: null,
      priceNote: 'تسميك عظم الفك: 40-60 / التثبيت مع أغشية موجهة: 60-80 (بند مركّب من بندين فرعيين كما ورد في المصدر)'
    },
    {
      code: '16-17', category: 'implants',
      nameAr: 'رفع الجيب الفكي غير المباشر لجانب واحد ما عدا ثمن المواد',
      priceMinJOD: 80, priceMaxJOD: 120,
      priceNote: null
    },
    {
      code: '16-18', category: 'implants',
      nameAr: 'رفع الجيب الفكي المباشر لجانب واحد',
      priceMinJOD: 200, priceMaxJOD: 300,
      priceNote: null
    },
    {
      code: '17-10', category: 'periodontics',
      nameAr: 'تقليح الرواسب الكلسية مع الصقل لكامل الفم',
      priceMinJOD: 10, priceMaxJOD: 25,
      priceNote: null
    },
    {
      code: '17-11', category: 'periodontics',
      nameAr: 'تقليح عميق لما تحت اللثة مع التجريف اللثوي وصقل جذور الاسنان لمقطع من من ستة اسنان/ بدون شريحة مفتوحة',
      priceMinJOD: 15, priceMaxJOD: 30,
      priceNote: null
    },
    {
      code: '17-12', category: 'periodontics',
      nameAr: 'عملية قطع اللثة وتجميلها لمقطع من ستة اسنان',
      priceMinJOD: 40, priceMaxJOD: 60,
      priceNote: null
    },
    {
      code: '17-13', category: 'periodontics',
      nameAr: 'عملية تجميل اللثة لمقطع من ستة اسنان',
      priceMinJOD: 30, priceMaxJOD: 60,
      priceNote: null
    },
    {
      code: '17-14', category: 'periodontics',
      nameAr: 'ازالة اللجام الرابط',
      priceMinJOD: 25, priceMaxJOD: 40,
      priceNote: null
    },
    {
      code: '17-15', category: 'periodontics',
      nameAr: 'عملية قطع اللثه لاطالة التاج الوحدة/ سن واحد',
      priceMinJOD: 15, priceMaxJOD: 30,
      priceNote: null
    },
    {
      code: '17-16', category: 'periodontics',
      nameAr: 'فصل جذر جراحيا',
      priceMinJOD: 20, priceMaxJOD: 30,
      priceNote: null
    },
    {
      code: '17-17', category: 'periodontics',
      nameAr: 'عملية جراحية التطعيم اللثوي لسن واحد',
      priceMinJOD: 80, priceMaxJOD: 120,
      priceNote: null
    },
    {
      code: '17-18', category: 'periodontics',
      nameAr: 'تطبيق الصفائح لغايات المعالجة الثوية مع الجهاز المقطع من ستة اسنان',
      priceMinJOD: 75, priceMaxJOD: 100,
      priceNote: null
    },
    {
      code: '17-19', category: 'periodontics',
      nameAr: 'عملية التطعيم العظمي جراحيا لمقطع من 1 – 6 ويضاف الية من المواد',
      priceMinJOD: 150, priceMaxJOD: 170,
      priceNote: null
    },
    {
      code: '17-20', category: 'periodontics',
      nameAr: 'عملية تشذيب اللثة مع التداخل العظمي لمقطع من ستة اسنان',
      priceMinJOD: 50, priceMaxJOD: 75,
      priceNote: null
    },
    {
      code: '17-21', category: 'periodontics',
      nameAr: 'استخدام الغشاء الموجة لترميم الانسجة',
      priceMinJOD: 200, priceMaxJOD: 300,
      priceNote: null
    },
    {
      code: '18-10', category: 'oral_medicine',
      nameAr: 'المعالجة بابرة الكورتيزون للافات الفموية/ للجلسة الواحدة',
      priceMinJOD: 20, priceMaxJOD: 25,
      priceNote: null
    },
    {
      code: '18-11', category: 'oral_medicine',
      nameAr: 'المعالجة الموضعية للافات القابلة للتسرطن / للجلسة الواحدة',
      priceMinJOD: 15, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '18-12', category: 'oral_medicine',
      nameAr: 'اخذ عينة نسجية تحت التخدير الموضعي او ازالة عينة لحمية صغيرة من انسجة الفم الطرية تحت التخدير الموضعي',
      priceMinJOD: 20, priceMaxJOD: 25,
      priceNote: null
    },
    {
      code: '18-13', category: 'oral_medicine',
      nameAr: 'اخذ مسحة Smear or Swab',
      priceMinJOD: 10, priceMaxJOD: 12,
      priceNote: null
    },
    {
      code: '19-10', category: 'surgery',
      nameAr: 'القلع العادي',
      priceMinJOD: 3, priceMaxJOD: 10,
      priceNote: null
    },
    {
      code: '19-11', category: 'surgery',
      nameAr: 'القلع مع فصل الجذور',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '19-12', category: 'surgery',
      nameAr: 'قلع جذر متبقي مكسور للسن الواحد',
      priceMinJOD: 10, priceMaxJOD: 25,
      priceNote: null
    },
    {
      code: '19-13', category: 'surgery',
      nameAr: 'قلع جذر متبقي مكسور جراحيا مع قص العظم',
      priceMinJOD: 25, priceMaxJOD: 50,
      priceNote: null
    },
    {
      code: '19-14', category: 'surgery',
      nameAr: 'فتح خراج داخل الفم / تفجير وتصريف',
      priceMinJOD: 10, priceMaxJOD: 20,
      priceNote: null
    },
    {
      code: '19-15', category: 'surgery',
      nameAr: 'فتح خراج خارج الفم / تفجير وتصريف',
      priceMinJOD: 40, priceMaxJOD: 80,
      priceNote: null
    },
    {
      code: '19-16', category: 'surgery',
      nameAr: 'قلع ضرس مطمور بالانسجة الرخوة',
      priceMinJOD: 15, priceMaxJOD: 25,
      priceNote: null
    },
    {
      code: '19-17', category: 'surgery',
      nameAr: 'قلع ضرس نصف مطمور بالعظم',
      priceMinJOD: 30, priceMaxJOD: 50,
      priceNote: null
    },
    {
      code: '19-18', category: 'surgery',
      nameAr: 'قلع ضرس مطمور كاملا  بالعظم',
      priceMinJOD: 50, priceMaxJOD: 100,
      priceNote: null
    },
    {
      code: '19-19', category: 'surgery',
      nameAr: 'اعادة غرس السن وتثبيته ( جراحيا) بغير الطرق التقويمية',
      priceMinJOD: 50, priceMaxJOD: 120,
      priceNote: null
    },
    {
      code: '19-20', category: 'surgery',
      nameAr: 'ازالة الزوائد العظمية لجهة واحدة من الفك جراحيا',
      priceMinJOD: 40, priceMaxJOD: 60,
      priceNote: null
    },
    {
      code: '19-21', category: 'surgery',
      nameAr: 'كشف عن سن دائم متاخر النمو بازالة النسيج الرخو',
      priceMinJOD: 5, priceMaxJOD: 15,
      priceNote: null
    },
    {
      code: '19-22', category: 'surgery',
      nameAr: 'كشف جراحي على السن مطمور بقص العظم',
      priceMinJOD: 20, priceMaxJOD: 50,
      priceNote: null
    },
    {
      code: '19-23', category: 'surgery',
      nameAr: 'تعميق الدهليز لاغراض الاستعاضة الصناعية لكل فك',
      priceMinJOD: 80, priceMaxJOD: 100,
      priceNote: null
    },
    {
      code: '19-24', category: 'surgery',
      nameAr: 'تعميق الدهليز لاغراض الاستعاضة الصناعية / حالة كبرى مع استعمال طقم جلدي , عظمي او صناعي لكل فك',
      priceMinJOD: 100, priceMaxJOD: 150,
      priceNote: null
    },
    {
      code: '19-25', category: 'surgery',
      nameAr: 'اغلاق الفتحة الفموية الجيبية جراحيا',
      priceMinJOD: 80, priceMaxJOD: 100,
      priceNote: null
    },
    {
      code: '19-26', category: 'surgery',
      nameAr: 'قطع العظم الفكي وازالة المتموت منه',
      priceMinJOD: 100, priceMaxJOD: 120,
      priceNote: null
    },
    {
      code: '19-27', category: 'surgery',
      nameAr: 'عملية ازالة كيس او فتحة بدون ازالة',
      priceMinJOD: 80, priceMaxJOD: 100,
      priceNote: null
    },
    {
      code: '19-28', category: 'surgery',
      nameAr: 'ازالة كيس مخاطي',
      priceMinJOD: 25, priceMaxJOD: 50,
      priceNote: null
    },
    {
      code: '19-29', category: 'surgery',
      nameAr: 'عملية تجبير كسر الفك الواحد بدون فتح جراحي',
      priceMinJOD: 125, priceMaxJOD: 150,
      priceNote: null
    },
    {
      code: '19-30', category: 'surgery',
      nameAr: 'عملية تجبير كسر الفك الواحد مع فتح جراحي/ حالة متوسطة',
      priceMinJOD: 250, priceMaxJOD: 400,
      priceNote: null
    },
    {
      code: '19-31', category: 'surgery',
      nameAr: 'عملية تجبير كسر الفك الواحد مع فتح جراحي/ حالة كبرى',
      priceMinJOD: 400, priceMaxJOD: 600,
      priceNote: null
    },
    {
      code: '19-32', category: 'surgery',
      nameAr: 'عملية استاصال الورم الفكي / عملية صغرى',
      priceMinJOD: 150, priceMaxJOD: 250,
      priceNote: null
    },
    {
      code: '19-33', category: 'surgery',
      nameAr: 'عملية استاصال الورم الفكي / عملية متوسطة',
      priceMinJOD: 250, priceMaxJOD: 400,
      priceNote: null
    },
    {
      code: '19-34', category: 'surgery',
      nameAr: 'عملية استاصال الورم الفكي / عملية كبرى',
      priceMinJOD: 400, priceMaxJOD: 600,
      priceNote: null
    },
    {
      code: '19-35', category: 'surgery',
      nameAr: 'عملية ازالة التصاق المفصل الفكي الصدغي جراحيا مع التطعيم',
      priceMinJOD: 500, priceMaxJOD: 750,
      priceNote: null
    },
    {
      code: '19-36', category: 'surgery',
      nameAr: 'عملية جراحية لاحد الفكين بقطع جزئي للعظم',
      priceMinJOD: 300, priceMaxJOD: 450,
      priceNote: null
    },
    {
      code: '19-37', category: 'surgery',
      nameAr: 'عملية جراحية لاحد الفكين كامل للعظم',
      priceMinJOD: 500, priceMaxJOD: 700,
      priceNote: null
    },
    {
      code: '19-38', category: 'surgery',
      nameAr: 'عملية جراحية لكلا الفكين معا',
      priceMinJOD: 1000, priceMaxJOD: 1500,
      priceNote: null
    },
    {
      code: '19-39', category: 'surgery',
      nameAr: 'رد المفصل الفكي الصدغي المخلوع',
      priceMinJOD: 10, priceMaxJOD: 30,
      priceNote: null
    },
    {
      code: '19-40', category: 'surgery',
      nameAr: 'عمليات الغدد اللعابية/ استئصال الحصاة من الاقنية اللعابية',
      priceMinJOD: 100, priceMaxJOD: 150,
      priceNote: null
    },
    {
      code: '19-41', category: 'surgery',
      nameAr: 'عمليات الغدد اللعابية/ استئصال الغدة اللعابية تحت الفكية',
      priceMinJOD: 400, priceMaxJOD: 500,
      priceNote: null
    },
    {
      code: '19-42', category: 'surgery',
      nameAr: 'عمليات الغدد اللعابية/ استئصال الغدة اللعابية النكفية',
      priceMinJOD: 500, priceMaxJOD: 700,
      priceNote: null
    },
    {
      code: '19-43', category: 'surgery',
      nameAr: 'عمليات الغدد اللعابية/ استئصال الغدة اللعابية تحت اللسانية',
      priceMinJOD: 200, priceMaxJOD: 300,
      priceNote: null
    },
    {
      code: '19-44', category: 'surgery',
      nameAr: 'اخذ عينة نسيجية من انسجة الفم الطرية تحت البنج الموضعي',
      priceMinJOD: 20, priceMaxJOD: 25,
      priceNote: null
    },
    {
      code: '19-45', category: 'surgery',
      nameAr: 'اخذ عينة نسيجية من عظمية تحت البنج الموضعي',
      priceMinJOD: 40, priceMaxJOD: 50,
      priceNote: null
    },
    {
      code: '19-46', category: 'surgery',
      nameAr: 'جراحة اللسان / قطع جزئي',
      priceMinJOD: 150, priceMaxJOD: 250,
      priceNote: null
    },
    {
      code: '19-47', category: 'surgery',
      nameAr: 'جراحة اللسان / قطع جزئي مع جراحة الرقبة',
      priceMinJOD: 600, priceMaxJOD: 900,
      priceNote: null
    },
  ];

  var _byCode = null;
  function _index() {
    if (_byCode) return _byCode;
    _byCode = {};
    PROCEDURES.forEach(function (p) { _byCode[p.code] = p; });
    return _byCode;
  }

  /** Exact procedure record by official code (e.g. '11-13'), or null. */
  function getProcedureByCode(code) {
    return _index()[code] || null;
  }

  /** All procedures in one category key (see CATEGORIES), in source order. */
  function getProceduresByCategory(categoryKey) {
    return PROCEDURES.filter(function (p) { return p.category === categoryKey; });
  }

  /** All category definitions, in source order. */
  function getAllCategories() {
    return CATEGORIES.slice();
  }

  /** All 128 procedures, in source order. Callers must not mutate the result. */
  function getAllProcedures() {
    return PROCEDURES.slice();
  }

  /**
   * Search by code fragment or Arabic name fragment (case-insensitive for
   * the code; substring match for the Arabic name). Used by the catalog
   * search/filter UI (master spec section 25).
   */
  function searchProcedures(query) {
    if (!query) return PROCEDURES.slice();
    var q = String(query).trim().toLowerCase();
    return PROCEDURES.filter(function (p) {
      return p.code.toLowerCase().indexOf(q) !== -1 || p.nameAr.indexOf(query.trim()) !== -1;
    });
  }

  /**
   * Structural self-check: confirms all 128 official codes are present
   * exactly once. Does NOT verify the Arabic text against the source
   * (that is a human sign-off step — see PROCEDURE_CATALOG_VERIFICATION.md).
   * Returns { ok, count, duplicates, missing }.
   */
  function verifyCatalogCompleteness() {
    var EXPECTED_COUNT = 128;
    var seen = {};
    var duplicates = [];
    PROCEDURES.forEach(function (p) {
      if (seen[p.code]) duplicates.push(p.code);
      seen[p.code] = true;
    });
    return {
      ok: PROCEDURES.length === EXPECTED_COUNT && duplicates.length === 0,
      count: PROCEDURES.length,
      expected: EXPECTED_COUNT,
      duplicates: duplicates
    };
  }

  global.DentalProcedureCatalog = {
    getProcedureByCode: getProcedureByCode,
    getProceduresByCategory: getProceduresByCategory,
    getAllCategories: getAllCategories,
    getAllProcedures: getAllProcedures,
    searchProcedures: searchProcedures,
    verifyCatalogCompleteness: verifyCatalogCompleteness
  };
}(window));
