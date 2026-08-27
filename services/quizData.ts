// 答题模式 - 全局题库
// 每个模型 8-10 题（少儿兴趣题库 10-12 题），题型混合（既有二选一也有四选一）；
// 进入答题模式时随机抽取 5 题。错题本按 category（化学 / 生物 / 地理 / 少儿兴趣）归类。

import type { ModelInfoCategory } from './modelInfoProfiles';

export type QuizCategory = ModelInfoCategory | '少儿兴趣';

export interface QuizQuestion {
  id: string;
  modelUrl: string; // 唯一对应模型
  subject: string; // UI 上显示的中文名称
  category: QuizCategory;
  question: string;
  options: string[]; // 长度为 2（二选一）或 4（四选一）
  correctIndex: number;
  explanation: string;
  /** 2 = 二选一题，4 = 四选一题。UI 根据此字段决定排版与统计。 */
  optionType: 2 | 4;
}

export interface QuizSession {
  questions: QuizQuestion[];
  currentIndex: number;
  answers: (number | null)[];
  startTime: number;
}

// ─────────────── 心 脏 模 型（生物） ───────────────
const HEART_QUESTIONS: QuizQuestion[] = [
  {
    id: 'heart-1', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '人体心脏有几个腔室？',
    options: ['两个腔室', '三个腔室', '四个腔室', '五个腔室'],
    correctIndex: 2,
    explanation: '人体心脏分为左心房、左心室、右心房、右心室四个腔室。',
  },
  {
    id: 'heart-2', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 2,
    question: '心脏中哪个腔室的肌肉壁最厚？',
    options: ['左心室', '右心室'],
    correctIndex: 0,
    explanation: '左心室负责将血液泵向全身（体循环），需要更大的压力，因此肌肉壁最厚。',
  },
  {
    id: 'heart-3', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '血液从右心室泵出后，首先进入哪个血管？',
    options: ['主动脉', '肺动脉', '肺静脉', '上腔静脉'],
    correctIndex: 1,
    explanation: '右心室将血液泵入肺动脉，进行肺循环，在肺部进行气体交换后经肺静脉回到左心房。',
  },
  {
    id: 'heart-4', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '左心房和左心室之间的瓣膜叫什么？',
    options: ['二尖瓣', '三尖瓣', '主动脉瓣', '肺动脉瓣'],
    correctIndex: 0,
    explanation: '左心房与左心室之间是二尖瓣，它能防止血液倒流回心房。',
  },
  {
    id: 'heart-5', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '心脏自身跳动的电信号起源于哪里？',
    options: ['窦房结', '房室结', '浦肯野纤维', '房室束'],
    correctIndex: 0,
    explanation: '窦房结被称为心脏的天然起搏器，它产生电信号引发心脏收缩。',
  },
  {
    id: 'heart-6', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '一个健康成年人安静时的心率大约是？',
    options: ['每分钟 20-40 次', '每分钟 60-100 次', '每分钟 150-200 次', '每分钟 250-300 次'],
    correctIndex: 1,
    explanation: '健康成年人安静时心率通常在 60-100 次/分钟，运动员可能更低。',
  },
  {
    id: 'heart-7', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 2,
    question: '心脏为人体提供的是什么动力？',
    options: ['血液循环的动力', '消化食物的动力'],
    correctIndex: 0,
    explanation: '心脏通过节律性收缩为血液循环提供动力，把血液输送到全身。',
  },
  {
    id: 'heart-8', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '给心脏自身肌肉供应血液的血管叫什么？',
    options: ['肺动脉', '冠状动脉', '颈动脉', '肾动脉'],
    correctIndex: 1,
    explanation: '冠状动脉像一顶"冠"一样环绕在心脏表面，专门给心肌提供血液和氧气。',
  },
  {
    id: 'heart-9', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '下列哪一种血管里通常流的是动脉血（含氧丰富）？',
    options: ['肺动脉', '肺静脉', '上腔静脉', '下腔静脉'],
    correctIndex: 1,
    explanation: '肺静脉把在肺里完成气体交换后含氧丰富的血液带回左心房，因此流的是动脉血。',
  },
  {
    id: 'heart-10', modelUrl: '/models/heart-optimized.glb', subject: '心脏模型',
    category: '生物', optionType: 4,
    question: '心电图（ECG）主要用来检查什么？',
    options: ['肝脏功能', '心脏电活动', '肾脏滤过率', '肺活量大小'],
    correctIndex: 1,
    explanation: '心电图通过记录心脏的电活动来评估心跳节律和心脏健康状况。',
  },
];

// ─────────────── HIV 病 毒 模 型（生物） ───────────────
const HIV_QUESTIONS: QuizQuestion[] = [
  {
    id: 'hiv-1', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 2,
    question: 'HIV 病毒的遗传物质是什么？',
    options: ['RNA', 'DNA'],
    correctIndex: 0,
    explanation: 'HIV 是一种逆转录病毒，其核心包含两条单链 RNA 作为遗传物质。',
  },
  {
    id: 'hiv-2', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 病毒主要攻击人体免疫系统中的哪种细胞？',
    options: ['辅助性 T 细胞', 'B 淋巴细胞', '红细胞', '血小板'],
    correctIndex: 0,
    explanation: 'HIV 主要感染并破坏带有 CD4 受体的辅助性 T 细胞（CD4+ T 细胞）。',
  },
  {
    id: 'hiv-3', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 病毒表面用于附着宿主细胞的关键蛋白是什么？',
    options: ['gp120 蛋白', '血凝素蛋白', '胰岛素', '胶原蛋白'],
    correctIndex: 0,
    explanation: 'HIV 表面的包膜糖蛋白 gp120 能够与宿主细胞的 CD4 受体特异性结合。',
  },
  {
    id: 'hiv-4', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 病毒在细胞内复制时，利用哪种特殊的酶将 RNA 转化为 DNA？',
    options: ['逆转录酶', 'RNA 聚合酶', 'DNA 聚合酶', '解旋酶'],
    correctIndex: 0,
    explanation: 'HIV 病毒携带逆转录酶，进入宿主细胞后将自身的 RNA 逆转录成 DNA 并整合到宿主基因组中。',
  },
  {
    id: 'hiv-5', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 病毒衣壳通常呈现什么形状？',
    options: ['正方体', '圆锥形', '正八面体', '螺旋管'],
    correctIndex: 1,
    explanation: '成熟的 HIV 病毒粒子内部有一个特征性的圆锥形（锥状）核心衣壳，包裹着 RNA 和酶。',
  },
  {
    id: 'hiv-6', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 2,
    question: 'HIV 主要通过哪些途径传播？',
    options: ['血液和体液传播', '日常拥抱传播'],
    correctIndex: 0,
    explanation: 'HIV 通过血液、体液和母婴等途径传播，日常接触如拥抱、握手不会传播。',
  },
  {
    id: 'hiv-7', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: '未经治疗的 HIV 感染持续发展，可能导致哪种综合征？',
    options: ['获得性免疫缺陷综合征（AIDS）', '唐氏综合征', '帕金森综合征', '代谢综合征'],
    correctIndex: 0,
    explanation: '未经有效治疗时，HIV 会持续破坏 CD4+ T 细胞，最终可能发展为艾滋病（AIDS）。',
  },
  {
    id: 'hiv-8', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: '下列哪种行为不会传播 HIV？',
    options: ['共用注射器', '与感染者握手', '无保护性行为', '母婴传播'],
    correctIndex: 1,
    explanation: '握手、拥抱、共用餐具等日常接触都不会传播 HIV。',
  },
  {
    id: 'hiv-9', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: 'HIV 的"窗口期"指的是什么？',
    options: ['病毒感染后到能被检出抗体之间的时间', '病毒在空气中存活的时间', '感染者恢复的时间', '病毒休眠的时间'],
    correctIndex: 0,
    explanation: '"窗口期"是指感染后到现有检测方法能可靠查出抗体之间的时间段。',
  },
  {
    id: 'hiv-10', modelUrl: '/models/hiv-virus.glb', subject: 'HIV 病毒模型',
    category: '生物', optionType: 4,
    question: '国际上用红丝带象征什么？',
    options: ['关注艾滋病防治', '环境保护', '节约用水', '交通安全'],
    correctIndex: 0,
    explanation: '红丝带是世界艾滋病防治的标志，象征对感染者的关爱与防治意识的普及。',
  },
];

// ─────────────── 金 刚 石 模 型（化学） ───────────────
const DIAMOND_QUESTIONS: QuizQuestion[] = [
  {
    id: 'dia-1', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石中每个碳原子与周围几个碳原子成键？',
    options: ['2 个', '3 个', '4 个', '6 个'],
    correctIndex: 2,
    explanation: '每个碳原子以 sp3 杂化，与周围 4 个碳原子形成坚固的共价键。',
  },
  {
    id: 'dia-2', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石的碳原子空间排列构成了什么几何形状？',
    options: ['正四面体', '正六边形', '正五边形', '正三角形'],
    correctIndex: 0,
    explanation: '碳原子之间以共价键相连，形成连续的、高度对称的正四面体立体网状结构。',
  },
  {
    id: 'dia-3', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石之所以是自然界已知最硬的物质，是因为？',
    options: ['全为牢固的共价键', '原子之间距离极远', '密度很大', '含有大量金属'],
    correctIndex: 0,
    explanation: '整个晶体由强大的 C-C 共价键构成三维网状结构，键能极大，导致极高的硬度。',
  },
  {
    id: 'dia-4', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石晶体属于哪一类晶体？',
    options: ['离子晶体', '原子晶体（共价晶体）', '分子晶体', '金属晶体'],
    correctIndex: 1,
    explanation: '由于金刚石是由碳原子通过共价键连接而成的三维网络，它属于典型的原子晶体。',
  },
  {
    id: 'dia-5', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 2,
    question: '纯净的金刚石通常是否导电？',
    options: ['不导电', '导电'],
    correctIndex: 0,
    explanation: '金刚石中没有自由移动的电子（所有价电子都参与形成共价键），因此它不导电。',
  },
  {
    id: 'dia-6', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石的化学组成可以简写为？',
    options: ['Si', 'C', 'Fe', 'Au'],
    correctIndex: 1,
    explanation: '金刚石由碳（C）元素组成，是碳的一种同素异形体。',
  },
  {
    id: 'dia-7', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '金刚石和石墨都是由碳组成，但它们的什么性质差别最大？',
    options: ['硬度与导电性', '所含元素种类', '原子序数', '颜色是否为白色'],
    correctIndex: 0,
    explanation: '金刚石坚硬不导电，石墨柔软且导电，差异源于内部碳原子的排列方式。',
  },
  {
    id: 'dia-8', modelUrl: '/models/diamond.glb', subject: '金刚石模型',
    category: '化学', optionType: 4,
    question: '常被用来划玻璃的常见物品中，硬度最接近金刚石的是？',
    options: ['普通玻璃', '碳化钨', '塑料尺', '木棒'],
    correctIndex: 1,
    explanation: '碳化钨等超硬材料常用于工业切割，硬度仅次于金刚石等少数材料。',
  },
];

// ─────────────── 金 刚 石 晶 胞（化学） ───────────────
const DIAMOND_UNIT_CELL_QUESTIONS: QuizQuestion[] = [
  {
    id: 'duc-1', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '一个金刚石晶胞中实际上包含几个完整的碳原子？',
    options: ['2 个', '4 个', '6 个', '8 个'],
    correctIndex: 3,
    explanation: '顶点占 8×1/8=1 个，面心占 6×1/2=3 个，体内有 4 个完全属于该晶胞，共计 1+3+4 = 8 个碳原子。',
  },
  {
    id: 'duc-2', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '金刚石晶胞属于哪种晶格类型？',
    options: ['面心立方 (FCC)', '体心立方 (BCC)', '简单立方', '六方密堆积'],
    correctIndex: 0,
    explanation: '金刚石晶体结构可以看作是两套面心立方晶格沿着体对角线错开 1/4 长度嵌套而成。',
  },
  {
    id: 'duc-3', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '在金刚石晶胞内部的四个碳原子占据了什么位置？',
    options: ['八面体空隙', '四面体空隙', '体心', '顶点'],
    correctIndex: 1,
    explanation: '这四个碳原子占据了面心立方晶格中 8 个四面体空隙的一半（即 4 个）。',
  },
  {
    id: 'duc-4', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '金刚石晶胞的空间利用率大约是多少？',
    options: ['34%', '52%', '68%', '74%'],
    correctIndex: 0,
    explanation: '由于正四面体结构比较疏松，金刚石的空间利用率仅约为 34%，是比较小的。',
  },
  {
    id: 'duc-5', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '碳原子之间通过什么类型的轨道杂化形成这种晶胞结构？',
    options: ['sp 杂化', 'sp2 杂化', 'sp3 杂化', 'sp3d 杂化'],
    correctIndex: 2,
    explanation: '在金刚石中，碳原子的 2s 轨道和三个 2p 轨道进行 sp3 杂化，形成四个等价的杂化轨道。',
  },
  {
    id: 'duc-6', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 2,
    question: '金刚石晶胞的形状属于？',
    options: ['立方体', '三棱柱'],
    correctIndex: 0,
    explanation: '金刚石晶胞是一个立方体，每个角均为 90 度，三边长度相等。',
  },
  {
    id: 'duc-7', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '金刚石的最小重复结构单元称作？',
    options: ['晶胞', '晶界', '晶簇', '晶面'],
    correctIndex: 0,
    explanation: '晶胞是晶体结构中在三维空间重复出现的最小结构单元。',
  },
  {
    id: 'duc-8', modelUrl: '/models/diamond-unit-cell_NIH3D.glb', subject: '金刚石晶胞',
    category: '化学', optionType: 4,
    question: '沿晶胞体对角线方向观察金刚石结构时，下列说法正确的是？',
    options: ['可以看到两套错开的面心立方子晶格', '完全均匀的简单立方', '只能看到一个原子', '呈螺旋状结构'],
    correctIndex: 0,
    explanation: '沿体对角线方向观察，可以清晰看到两套面心立方子晶格相互错开嵌套的结构。',
  },
];

// ─────────────── 1,4- 二 氯 甲 基 苯（化学） ───────────────
const DICHLOROTOLUENE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'pub-1', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '1,4-二氯甲基苯分子中包含几个氯原子？',
    options: ['1 个', '2 个', '3 个', '4 个'],
    correctIndex: 1,
    explanation: '分子中包含两个氯原子（Cl），这从名称中的"二氯"即可判断。',
  },
  {
    id: 'pub-2', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '该分子中的芳香环是什么类型的环？',
    options: ['环己烷环', '苯环', '环戊二烯环', '吡咯环'],
    correctIndex: 1,
    explanation: '它是一种芳香族化合物，中心结构是一个由六个碳原子组成的苯环。',
  },
  {
    id: 'pub-3', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '"1,4-" 在化学命名中代表两个取代基处于什么位置关系？',
    options: ['邻位 (ortho)', '间位 (meta)', '对位 (para)', '连位'],
    correctIndex: 2,
    explanation: '在苯环上，1,4-位置即相对的对角线位置，被称为"对位"。',
  },
  {
    id: 'pub-4', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '苯环上的碳原子采用的是什么杂化方式？',
    options: ['sp 杂化', 'sp2 杂化', 'sp3 杂化', 'sp3d 杂化'],
    correctIndex: 1,
    explanation: '苯环上的碳原子全部采用 sp2 杂化，形成平面六边形结构，并存在离域大 π 键。',
  },
  {
    id: 'pub-5', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '这个分子是否具有偶极矩？',
    options: ['有，它是极性分子', '没有，它是非极性分子', '偶极矩为零', '无法判断'],
    correctIndex: 0,
    explanation: '虽然主结构有一定对称性，但由于取代基（甲基和氯原子）不同且不对称，它是极性分子。',
  },
  {
    id: 'pub-6', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '该分子的核心骨架有多少个原子共平面？',
    options: ['6 个碳', '10 个以上的原子', '只有 2 个', '没有一个'],
    correctIndex: 1,
    explanation: '苯环本身是 6 个共面碳原子，加上与之相连的原子，整体有 10 个以上原子共面。',
  },
  {
    id: 'pub-7', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 2,
    question: '"二氯甲基"中的"二氯"是指分子里含有几个氯原子？',
    options: ['2 个', '4 个'],
    correctIndex: 0,
    explanation: '"二氯"代表两个氯原子；甲基是 -CH3，"二氯甲基"指两个 Cl 取代了甲基上的两个 H。',
  },
  {
    id: 'pub-8', modelUrl: '/models/pubchem-6233-bas-color-print_NIH3D.glb', subject: '1,4-二氯甲基苯',
    category: '化学', optionType: 4,
    question: '这种分子常被归入哪一类有机化合物？',
    options: ['芳香族化合物', '无机盐', '金属配合物', '有机高分子聚合物'],
    correctIndex: 0,
    explanation: '因为含有苯环结构，它属于芳香族有机化合物。',
  },
];

// ─────────────── NaCl 离 子 晶 体（化学） ───────────────
const NACL_QUESTIONS: QuizQuestion[] = [
  {
    id: 'nacl-1', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: 'NaCl 晶体是由什么粒子构成的？',
    options: ['钠离子和氯离子', '钠原子和氯原子', '水分子和钠离子', '氢原子和氧原子'],
    correctIndex: 0,
    explanation: 'NaCl 是离子晶体，由带正电的钠离子（Na⁺）和带负电的氯离子（Cl⁻）构成。',
  },
  {
    id: 'nacl-2', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '在 NaCl 晶体中，每个 Na⁺ 周围紧邻几个 Cl⁻？',
    options: ['2 个', '4 个', '6 个', '8 个'],
    correctIndex: 2,
    explanation: '在面心立方晶格中，每个钠离子的上、下、左、右、前、后共有 6 个紧邻的氯离子（配位数为 6）。',
  },
  {
    id: 'nacl-3', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '由于存在强烈的静电吸引，NaCl 在常温下是什么状态？',
    options: ['气体', '液体', '固体', '等离子体'],
    correctIndex: 2,
    explanation: '强烈的离子键使得 NaCl 具有较高的熔点和沸点，在常温下呈现坚硬的固体状态。',
  },
  {
    id: 'nacl-4', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 2,
    question: '固态 NaCl 能否导电？',
    options: ['能', '不能'],
    correctIndex: 1,
    explanation: '固态离子晶体中离子被束缚在晶格中，无法自由移动，因此固态不导电；只有在熔融状态或水溶液中才导电。',
  },
  {
    id: 'nacl-5', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: 'NaCl 晶胞包含几个 NaCl "分子"？',
    options: ['1 个', '2 个', '3 个', '4 个'],
    correctIndex: 3,
    explanation: 'NaCl 晶胞中 Na⁺ 和 Cl⁻ 各有 4 个（通过顶点、面心和棱心、体心计算），相当于 4 个 NaCl "分子"。',
  },
  {
    id: 'nacl-6', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: 'NaCl 易溶于水是因为？',
    options: ['水分子能拆散离子键', 'NaCl 原子间距很大', 'NaCl 在水中会升华', 'NaCl 是金属'],
    correctIndex: 0,
    explanation: '水分子的极性作用能减弱 NaCl 晶格中的静电吸引，使 Na⁺ 和 Cl⁻ 进入水溶液。',
  },
  {
    id: 'nacl-7', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '下列哪种说法正确描述了 NaCl 中的化学键？',
    options: ['以离子键为主', '以共价键为主', '以金属键为主', '没有化学键'],
    correctIndex: 0,
    explanation: 'NaCl 由典型的金属与非金属之间的电子转移形成，以离子键为主。',
  },
  {
    id: 'nacl-8', modelUrl: '/models/nacl-crystal.glb', subject: 'NaCl 离子晶体',
    category: '化学', optionType: 4,
    question: '把 NaCl 加热到约 800 °C 时会发生什么？',
    options: ['熔化变成能导电的液体', '直接气化', '变成黑色固体', '硬度急剧上升'],
    correctIndex: 0,
    explanation: '约 800 °C 时 NaCl 熔化，离子变为可自由移动的状态，因此熔融 NaCl 能导电。',
  },
];

// ─────────────── SiO₂ 二 氧 化 硅（化学） ───────────────
const SIO2_QUESTIONS: QuizQuestion[] = [
  {
    id: 'sio2-1', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: 'SiO₂ 晶体中，每个硅原子与几个氧原子相连？',
    options: ['2 个', '3 个', '4 个', '6 个'],
    correctIndex: 2,
    explanation: '在 SiO₂（如石英）晶体中，每个硅原子与周围 4 个氧原子以共价键相连，形成正四面体。',
  },
  {
    id: 'sio2-2', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: 'SiO₂ 属于哪一种晶体类型？',
    options: ['分子晶体', '原子晶体', '离子晶体', '金属晶体'],
    correctIndex: 1,
    explanation: '二氧化硅是由硅原子和氧原子通过共价键组成的三维空间网状结构，属于原子晶体。',
  },
  {
    id: 'sio2-3', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '在 SiO₂ 网络中，每个氧原子连接着几个硅原子？',
    options: ['1 个', '2 个', '3 个', '4 个'],
    correctIndex: 1,
    explanation: '为了保持化学式比例为 1:2，每个氧原子必须且仅连接 2 个硅原子，充当桥梁的作用。',
  },
  {
    id: 'sio2-4', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: 'SiO₂ 晶体的熔点通常表现出怎样的特征？',
    options: ['极低，易挥发', '与水接近', '极高，坚硬耐高温', '随时间变化巨大'],
    correctIndex: 2,
    explanation: '打断三维共价键网络需要极高的能量，因此原子晶体通常具有非常高的熔点。',
  },
  {
    id: 'sio2-5', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '自然界中最常见的 SiO₂ 晶体矿物是什么？',
    options: ['石英', '方解石', '磁铁矿', '黄铁矿'],
    correctIndex: 0,
    explanation: '石英（Quartz）是自然界中广泛分布的二氧化硅晶体形态。',
  },
  {
    id: 'sio2-6', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 2,
    question: 'SiO₂ 的化学组成中，硅和氧的比例是？',
    options: ['1 : 2', '2 : 1'],
    correctIndex: 0,
    explanation: '二氧化硅的名称本身即表示硅氧原子数比为 1:2。',
  },
  {
    id: 'sio2-7', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '下列哪种材料的主要成分就是 SiO₂？',
    options: ['普通玻璃', '金属铜', '橡胶', '聚乙烯塑料'],
    correctIndex: 0,
    explanation: '普通玻璃的主要成分是 SiO₂，加上其他助熔剂和调节剂。',
  },
  {
    id: 'sio2-8', modelUrl: '/models/sio2-crystal.glb', subject: 'SiO₂ 二氧化硅',
    category: '化学', optionType: 4,
    question: '纯净的 SiO₂ 晶体（如水晶）通常具有什么光学特性？',
    options: ['透明', '完全不透明', '只反射红外', '只吸收可见光'],
    correctIndex: 0,
    explanation: '纯净的 SiO₂ 晶体（如水晶）通常是无色透明的，可以透过可见光。',
  },
];

// ─────────────── 硝 基 苯（化学） ───────────────
const NITROBENZENE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'nitro-1', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯分子的化学式是什么？',
    options: ['C₆H₆', 'C₆H₅NO₂', 'C₆H₁₂O₆', 'CH₃COOH'],
    correctIndex: 1,
    explanation: '硝基苯是由苯环上的一颗氢原子被硝基（-NO₂）取代形成的，因此化学式为 C₆H₅NO₂。',
  },
  {
    id: 'nitro-2', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基（-NO₂）在这个分子中是一个怎样的官能团？',
    options: ['推电子基团', '吸电子基团', '中性基团', '碱性基团'],
    correctIndex: 1,
    explanation: '硝基中含有电负性很强的氧和氮，是一个强吸电子基团，会降低苯环的电子云密度。',
  },
  {
    id: 'nitro-3', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '在常温常压下，硝基苯的状态和颜色通常是？',
    options: ['无色气体', '苦杏仁味的淡黄色液体', '蓝色固体', '紫色粉末'],
    correctIndex: 1,
    explanation: '硝基苯是一种高沸点的油状液体，纯品为无色，但通常呈微黄色，具有苦杏仁味，有毒。',
  },
  {
    id: 'nitro-4', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯能和水互相溶解吗？',
    options: ['完全互溶', '部分互溶', '微溶易分层', '不溶于水'],
    correctIndex: 3,
    explanation: '硝基苯是有机溶剂，极性不大且苯环占据主导，因此它不溶于水，且密度比水大。',
  },
  {
    id: 'nitro-5', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯分子中是否所有的原子都处于同一个平面上？',
    options: ['不一定同平面', '严格完全同平面', '全部平行排列', '全部位于两条平行线'],
    correctIndex: 0,
    explanation: '由于硝基（-NO₂）中的 O-N 键可以围绕 C-N 键旋转，分子在某些构象下并非所有原子严格共面。',
  },
  {
    id: 'nitro-6', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '硝基苯在化工生产中常被用来做什么？',
    options: ['制造炸药和染料的中间体', '直接食用', '用作燃料电池', '作为饮用水'],
    correctIndex: 0,
    explanation: '硝基苯是制造苯胺、染料、炸药等的重要化工中间体。',
  },
  {
    id: 'nitro-7', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 2,
    question: '硝基苯属于什么样的有机物大类？',
    options: ['芳香族化合物', '脂肪烃'],
    correctIndex: 0,
    explanation: '因含有苯环结构，硝基苯属于芳香族有机化合物。',
  },
  {
    id: 'nitro-8', modelUrl: '/models/7416-bas-color-print_NIH3D.glb', subject: '硝基苯',
    category: '化学', optionType: 4,
    question: '在亲电取代反应中，硝基通常使苯环表现为何种定位效应？',
    options: ['间位定位', '邻位定位', '对位定位', '完全无定位'],
    correctIndex: 0,
    explanation: '硝基是强吸电子基，会钝化苯环并使新进入的取代基主要进入间位。',
  },
];

// ─────────────── 地 球 内 部 结 构（地理） ───────────────
const EARTH_QUESTIONS: QuizQuestion[] = [
  {
    id: 'earth-1', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球内部由外到内依次是哪三个圈层？',
    options: ['地壳、地幔、地核', '地幔、地壳、地核', '地核、地幔、地壳', '地壳、地核、地幔'],
    correctIndex: 0,
    explanation: '地球内部结构由外到内依次为：地壳（最薄）、地幔（最厚）、地核（最中心）。',
  },
  {
    id: 'earth-2', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 2,
    question: '地壳在大陆和海洋区域的厚度表现有何差异？',
    options: ['大陆地壳更厚', '海洋地壳更厚'],
    correctIndex: 0,
    explanation: '大陆地壳平均厚度约 33 千米，而大洋地壳较薄，平均仅约 6 千米。',
  },
  {
    id: 'earth-3', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地幔由于高温高压发生局部熔融的部分被称为什么？',
    options: ['岩石圈', '软流层', '生物圈', '水圈'],
    correctIndex: 1,
    explanation: '上地幔顶部存在一个软流层，物质呈半熔融状态，被认为是岩浆的主要发源地。',
  },
  {
    id: 'earth-4', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球的地核被划分为外核和内核，外核的物质处于什么状态？',
    options: ['液态', '固态', '气态', '等离子体'],
    correctIndex: 0,
    explanation: '由于地震波横波无法穿过外核，科学家推断外核主要由液态的铁和镍组成。',
  },
  {
    id: 'earth-5', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球磁场主要是由于地球哪一部分的流体运动产生的？',
    options: ['液态外核', '固态内核', '地壳', '地幔'],
    correctIndex: 0,
    explanation: '液态铁镍外核的对流运动，结合地球自转产生的科里奥利力，产生了所谓的"地磁发电机效应"。',
  },
  {
    id: 'earth-6', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地球的平均半径约为多少？',
    options: ['约 6,371 km', '约 1,000 km', '约 20,000 km', '约 50 km'],
    correctIndex: 0,
    explanation: '地球的平均半径约为 6,371 公里，赤道半径略大，两极半径略小。',
  },
  {
    id: 'earth-7', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '地壳的主要组成元素中，最常见的是？',
    options: ['氧、硅', '铜、锌', '金、银', '铁、镍'],
    correctIndex: 0,
    explanation: '地壳以硅酸盐矿物为主，最常见的元素是氧和硅。',
  },
  {
    id: 'earth-8', modelUrl: '/models/earth-layers.glb', subject: '地球内部结构',
    category: '地理', optionType: 4,
    question: '科学家研究地球内部圈层主要依靠什么方法？',
    options: ['直接钻探到地心', '分析地震波', '肉眼观察', '只通过地表采样'],
    correctIndex: 1,
    explanation: '由于人类无法直接观察地球深部，主要通过分析天然地震波在不同介质中的传播来推断内部结构。',
  },
];

// ─────────────── 地 形 地 貌（地理） ───────────────
const TERRAIN_QUESTIONS: QuizQuestion[] = [
  {
    id: 'terr-1', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '在地形图中，等高线密集的地方通常代表什么地形特征？',
    options: ['地形平缓', '坡度陡峭', '海面', '湖泊'],
    correctIndex: 1,
    explanation: '等高线越密集，表示在水平距离内海拔变化越大，也就是地形越陡峭。',
  },
  {
    id: 'terr-2', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '河流在上游山区强烈的向下侵蚀作用，最容易形成什么形状的峡谷？',
    options: ['U 形谷', 'V 形谷', '碟形谷', '盆地形'],
    correctIndex: 1,
    explanation: '河流上游落差大、流速快，以下切侵蚀为主，往往形成陡峻的"V"形峡谷。',
  },
  {
    id: 'terr-3', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '河流在入海口或入湖口，由于流速减缓导致的泥沙堆积地貌称作什么？',
    options: ['冲积扇', '三角洲', '沙丘', '冰碛'],
    correctIndex: 1,
    explanation: '河流携带的泥沙在河口处因水流变缓而沉积，形成类似三角形的平原，即三角洲。',
  },
  {
    id: 'terr-4', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '喀斯特地貌主要是由哪种岩石受到地下水溶蚀而形成的？',
    options: ['石灰岩', '花岗岩', '玄武岩', '砂岩'],
    correctIndex: 0,
    explanation: '石灰岩（碳酸钙）易受含有二氧化碳的水的化学溶蚀，从而形成溶洞、石林等地貌。',
  },
  {
    id: 'terr-5', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '风力侵蚀和风力堆积作用在何种气候区最为显著？',
    options: ['干旱、半干旱区', '湿润的热带雨林区', '寒带苔原区', '海洋气候区'],
    correctIndex: 0,
    explanation: '干旱地区植被稀少，风力作用强烈，容易形成沙丘（风积）和风蚀蘑菇（风蚀）等地貌。',
  },
  {
    id: 'terr-6', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '在山麓地带，河流出山口处由于流速骤减，常形成哪种地貌？',
    options: ['冲积扇', '河漫滩', '峡湾', '瀑布'],
    correctIndex: 0,
    explanation: '山区河流出山口时突然变宽变缓，泥沙沉积成扇形，即冲积扇。',
  },
  {
    id: 'terr-7', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 2,
    question: '"高山峡谷"主要由哪种外力作用形成？',
    options: ['流水侵蚀', '风力堆积'],
    correctIndex: 0,
    explanation: '高山峡谷大多是河流长期向下切割的结果，属典型的流水侵蚀地貌。',
  },
  {
    id: 'terr-8', modelUrl: '/models/terrain-topography.glb', subject: '地形地貌',
    category: '地理', optionType: 4,
    question: '观察一个地区地形常用的地图类型是？',
    options: ['政区图', '地形图', '气象图', '人口分布图'],
    correctIndex: 1,
    explanation: '地形图能直观展示高程、坡度等地表形态信息，是观察地形地貌的常用工具。',
  },
];

// ─────────────── 少 儿 兴 趣 题 库 ───────────────
const LANJINGLING_QUESTIONS: QuizQuestion[] = [
  {
    id: 'lanjingling-1', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蓝精灵身上最醒目的颜色是什么？',
    options: ['蓝色', '橙色', '绿色', '紫色'],
    correctIndex: 0,
    explanation: '蓝精灵最醒目的特点就是蓝色的身体，所以叫"蓝精灵"。',
  },
  {
    id: 'lanjingling-2', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '想看清蓝精灵模型的背面，可以怎么做？',
    options: ['闭上眼睛', '转动三维模型', '拆掉模型', '把它倒着拿'],
    correctIndex: 1,
    explanation: '转动三维模型，就能从前、后、左、右等不同方向观察它。',
  },
  {
    id: 'lanjingling-3', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蓝色最容易让人想到哪两样自然景物？',
    options: ['蓝天和大海', '火焰和太阳', '沙漠和岩石', '冰川和雪山'],
    correctIndex: 0,
    explanation: '晴朗的天空和清澈的大海常常呈现蓝色。',
  },
  {
    id: 'lanjingling-4', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 2,
    question: '小伙伴一起完成任务时，哪种做法更好？',
    options: ['互相争吵', '互相帮助'],
    correctIndex: 1,
    explanation: '互相帮助、分工合作，能让大家更顺利地完成任务。',
  },
  {
    id: 'lanjingling-5', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '在森林里游玩时，我们应该怎样对待花草？',
    options: ['爱护花草', '随意踩踏', '大量采摘', '当作垃圾'],
    correctIndex: 0,
    explanation: '花草和树木是许多生物的家，我们应该爱护它们。',
  },
  {
    id: 'lanjingling-6', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蘑菇属于下面哪一类生物？',
    options: ['小动物', '真菌', '植物', '细菌'],
    correctIndex: 1,
    explanation: '蘑菇属于真菌，不是植物，也不是小动物。',
  },
  {
    id: 'lanjingling-7', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '看到野外不认识的蘑菇，正确做法是什么？',
    options: ['不随便采吃', '马上尝一口', '立刻煮汤', '拿回家晾干'],
    correctIndex: 0,
    explanation: '有些野生蘑菇有毒，不认识时不能随便采摘和食用。',
  },
  {
    id: 'lanjingling-8', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '观察三维模型时，放大模型有什么用？',
    options: ['改变模型颜色', '看清细节', '让模型变小', '改变材质'],
    correctIndex: 1,
    explanation: '放大模型可以帮助我们看清衣服、表情和造型等细节。',
  },
  {
    id: 'lanjingling-9', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 4,
    question: '蓝精灵通常住在什么样的地方？',
    options: ['大城市的高楼', '森林里的小村庄', '海底宫殿', '沙漠绿洲'],
    correctIndex: 1,
    explanation: '在故事里，蓝精灵住在森林深处蘑菇形的小村庄里。',
  },
  {
    id: 'lanjingling-10', modelUrl: '/models/lanjingling.glb', subject: '蓝精灵',
    category: '少儿兴趣', optionType: 2,
    question: '蓝精灵的经典形象常常戴着一顶什么颜色的帽子？',
    options: ['白色', '红色'],
    correctIndex: 1,
    explanation: '蓝精灵通常戴着红色的小尖帽，这是他们最具辨识度的标志之一。',
  },
];

// ─────────────── 奈 李 模 型 ───────────────
const NAILI_QUESTIONS: QuizQuestion[] = [
  {
    id: 'naili-1', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '奈李属于哪一类食物？',
    options: ['水果', '蔬菜', '主食', '海鲜'],
    correctIndex: 0,
    explanation: '奈李是李子的一种，属于水果。',
  },
  {
    id: 'naili-2', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '奈李通常长在哪里？',
    options: ['水里', '树上', '土里', '岩石上'],
    correctIndex: 1,
    explanation: '奈李是李树结出的果实，生长在树枝上。',
  },
  {
    id: 'naili-3', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果实里面通常有什么？',
    options: ['果核', '贝壳', '金属屑', '塑料珠'],
    correctIndex: 0,
    explanation: '奈李中间有一颗较硬的果核，吃的时候要小心。',
  },
  {
    id: 'naili-4', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '吃新鲜奈李前，应该先做什么？',
    options: ['涂上颜料', '清洗干净', '在阳光下曝晒', '放入冰箱冷冻'],
    correctIndex: 1,
    explanation: '水果食用前要用干净的水认真清洗。',
  },
  {
    id: 'naili-5', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '奈李树开花以后，可能会慢慢长出什么？',
    options: ['奈李果实', '小石头', '金属片', '玻璃珠'],
    correctIndex: 0,
    explanation: '花经过授粉后，花的一部分会慢慢发育成果实。',
  },
  {
    id: 'naili-6', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '水果能为身体提供哪类营养？',
    options: ['塑料和玻璃', '维生素和膳食纤维', '重金属', '化学燃料'],
    correctIndex: 1,
    explanation: '水果通常含有维生素和膳食纤维，适量食用有益健康。',
  },
  {
    id: 'naili-7', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 2,
    question: '果农采摘奈李时，怎样做更合适？',
    options: ['轻拿轻放', '用力乱扔'],
    correctIndex: 0,
    explanation: '轻拿轻放可以减少碰伤，让果实保存得更好。',
  },
  {
    id: 'naili-8', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '吃奈李时，遇到坚硬的果核应该怎么做？',
    options: ['直接吞下', '吐出果核', '用力咬碎', '整颗吞下'],
    correctIndex: 1,
    explanation: '坚硬的果核不适合吞咽，吃的时候要小心取出。',
  },
  {
    id: 'naili-9', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '成熟的奈李外皮颜色通常是？',
    options: ['深紫红色或紫黑', '纯白色', '亮蓝色', '荧光绿色'],
    correctIndex: 0,
    explanation: '成熟的奈李通常呈深紫红色或紫黑色，外表裹着一层果粉。',
  },
  {
    id: 'naili-10', modelUrl: '/models/naili.glb', subject: '奈李',
    category: '少儿兴趣', optionType: 4,
    question: '食用过多水果也应该节制，主要原因是什么？',
    options: ['糖分摄入过多也不利于健康', '水果会让人失去记忆', '水果会让头发变色', '水果有放射性'],
    correctIndex: 0,
    explanation: '水果含有天然糖分，一次吃太多也可能让糖分摄入超标，需要适量。',
  },
];

// ─────────────── 奈 李 果 子 模 型 ───────────────
const NAILIGUOZI_QUESTIONS: QuizQuestion[] = [
  {
    id: 'nailiguozi-1', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果子属于哪一类食物？',
    options: ['水果', '玩具', '文具', '工具'],
    correctIndex: 0,
    explanation: '奈李果子是李子类水果，可以用来观察果实的形状和颜色。',
  },
  {
    id: 'nailiguozi-2', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果子一般长在哪里？',
    options: ['书包里', '树上', '衣柜里', '抽屉里'],
    correctIndex: 1,
    explanation: '奈李果子是李树结出的果实，通常长在树枝上。',
  },
  {
    id: 'nailiguozi-3', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '吃奈李果子前，最好先做什么？',
    options: ['清洗干净', '涂上颜料', '晒成干', '放进微波炉'],
    correctIndex: 0,
    explanation: '新鲜水果入口前要洗干净，这样更卫生。',
  },
  {
    id: 'nailiguozi-4', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '奈李果子中间通常会有什么？',
    options: ['小铃铛', '果核', '小电池', '小灯泡'],
    correctIndex: 1,
    explanation: '李子类水果中间一般有一颗较硬的果核，吃的时候要注意。',
  },
  {
    id: 'nailiguozi-5', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '果子成熟后，味道通常会变得怎样？',
    options: ['更甜一些', '像石头一样硬', '完全无味', '变得咸咸的'],
    correctIndex: 0,
    explanation: '很多水果成熟后会变软、变香，甜味也会更明显。',
  },
  {
    id: 'nailiguozi-6', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '水果能给身体补充什么？',
    options: ['沙子和玻璃', '维生素和水分', '金属离子', '塑料微粒'],
    correctIndex: 1,
    explanation: '水果通常含有水分、维生素和膳食纤维，适量吃对身体有帮助。',
  },
  {
    id: 'nailiguozi-7', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 2,
    question: '采摘奈李果子时，哪种做法更好？',
    options: ['轻轻摘下', '用力乱扔'],
    correctIndex: 0,
    explanation: '轻拿轻放可以减少果子碰伤，也能保护树枝。',
  },
  {
    id: 'nailiguozi-8', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '观察三维奈李果子模型时，放大模型可以看清什么？',
    options: ['天气预报', '果皮细节', '地下水位', '空气成分'],
    correctIndex: 1,
    explanation: '放大三维模型，可以更清楚地观察果皮、形状和颜色等细节。',
  },
  {
    id: 'nailiguozi-9', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '下列哪种水果也是"李子家族"的成员？',
    options: ['西瓜', '桃', '葡萄', '香蕉'],
    correctIndex: 1,
    explanation: '桃、李、杏、梅等都属于蔷薇科李属，是"李子家族"的成员。',
  },
  {
    id: 'nailiguozi-10', modelUrl: '/models/nailiguozi.glb', subject: '奈李果子',
    category: '少儿兴趣', optionType: 4,
    question: '观察模型时如果发现颜色发白，可能是？',
    options: ['表面自然形成的果粉', '模型破损', '温度过低', '光照太亮'],
    correctIndex: 0,
    explanation: '李子表面常见一层薄薄的白色果粉，那是天然形成的保护层，不影响食用。',
  },
];

// ─────────────── 小 韶 卿 IP 形 象 ───────────────
const XIAOSHAOQING_QUESTIONS: QuizQuestion[] = [
  {
    id: 'xiaoshaoqing-1', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 2,
    question: '"小韶卿"是哪一个地方的文旅 IP 形象？',
    options: ['仁化县周田镇', '北京市'],
    correctIndex: 0,
    explanation: '"小韶卿"是仁化县周田镇的文旅 IP 形象。',
  },
  {
    id: 'xiaoshaoqing-2', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '仁化县属于广东省的哪座城市？',
    options: ['深圳市', '韶关市', '广州市', '东莞市'],
    correctIndex: 1,
    explanation: '仁化县位于广东省韶关市。',
  },
  {
    id: 'xiaoshaoqing-3', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '周田镇的张屋古村属于哪一类景观？',
    options: ['历史古村落', '海底世界', '现代都市', '雪山营地'],
    correctIndex: 0,
    explanation: '张屋古村保存着古建筑和历史文化，是一座古村落。',
  },
  {
    id: 'xiaoshaoqing-4', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '张屋古村是哪位岭南诗人的祖居？',
    options: ['李白', '张九龄', '杜甫', '白居易'],
    correctIndex: 1,
    explanation: '张屋古村是岭南诗人张九龄的祖居，传承着九龄文化。',
  },
  {
    id: 'xiaoshaoqing-5', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '周田村流过的河流叫什么？',
    options: ['灵溪河', '黄河', '长江', '珠江'],
    correctIndex: 0,
    explanation: '灵溪河流经周田村，当地还建设了美丽河道和景观步道。',
  },
  {
    id: 'xiaoshaoqing-6', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '文旅 IP 形象可以帮助大家做什么？',
    options: ['忘记家乡故事', '认识当地文化和风景', '代替老师上课', '代替天气预报'],
    correctIndex: 1,
    explanation: '有趣的文旅 IP 形象能带大家认识当地的历史、文化和风景。',
  },
  {
    id: 'xiaoshaoqing-7', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '参观古村时，哪种做法是正确的？',
    options: ['保护古建筑', '在墙上乱刻字', '大声喧哗', '随手丢弃垃圾'],
    correctIndex: 0,
    explanation: '古建筑记录着历史，参观时不能乱刻乱画，要一起保护它们。',
  },
  {
    id: 'xiaoshaoqing-8', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 2,
    question: '游览美丽河道时，我们应该怎样做？',
    options: ['把垃圾扔进河里', '把垃圾带走'],
    correctIndex: 1,
    explanation: '不乱扔垃圾，才能让河水更清、环境更美。',
  },
  {
    id: 'xiaoshaoqing-9', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '小韶卿所代表的"九龄文化"主要源自哪一位历史人物？',
    options: ['张九龄', '孔子', '诸葛亮', '岳飞'],
    correctIndex: 0,
    explanation: '九龄文化指以张九龄为代表的岭南传统文化与人格精神。',
  },
  {
    id: 'xiaoshaoqing-10', modelUrl: '/models/xiaoshaoqing.glb', subject: '周田文旅 IP 形象「小韶卿」',
    category: '少儿兴趣', optionType: 4,
    question: '如果想了解更多关于小韶卿家乡的故事，下列哪种方式是合适的？',
    options: ['查阅当地文旅官网或公众号', '随意编造信息', '完全靠猜测', '只看电视剧'],
    correctIndex: 0,
    explanation: '官方网站或官方公众号会发布准确、丰富的家乡文化介绍。',
  },
];

// ─────────────── 题 库 合 并 ───────────────
const ALL_QUESTIONS: QuizQuestion[] = [
  ...HEART_QUESTIONS,
  ...HIV_QUESTIONS,
  ...DIAMOND_QUESTIONS,
  ...DIAMOND_UNIT_CELL_QUESTIONS,
  ...DICHLOROTOLUENE_QUESTIONS,
  ...NACL_QUESTIONS,
  ...SIO2_QUESTIONS,
  ...NITROBENZENE_QUESTIONS,
  ...EARTH_QUESTIONS,
  ...TERRAIN_QUESTIONS,
  ...LANJINGLING_QUESTIONS,
  ...NAILI_QUESTIONS,
  ...NAILIGUOZI_QUESTIONS,
  ...XIAOSHAOQING_QUESTIONS,
];

/**
 * Fisher-Yates 洗牌算法
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 从题库随机抽取指定数量的题目，创建答题会话
 */
export function createQuizSession(count: number = 5, modelUrlFilter?: string): QuizSession {
  let pool = ALL_QUESTIONS;
  if (modelUrlFilter) {
    pool = ALL_QUESTIONS.filter(q => q.modelUrl === modelUrlFilter);
  }
  const questions = shuffleArray(pool).slice(0, Math.min(count, pool.length));
  return {
    questions,
    currentIndex: 0,
    answers: new Array(questions.length).fill(null),
    startTime: Date.now(),
  };
}

/**
 * 计算答题结果
 */
export function getQuizResult(session: QuizSession) {
  let correctCount = 0;
  session.questions.forEach((q, i) => {
    if (session.answers[i] === q.correctIndex) {
      correctCount++;
    }
  });
  const totalTime = Math.round((Date.now() - session.startTime) / 1000);
  const totalQuestions = session.questions.length;
  const accuracy = Math.round((correctCount / totalQuestions) * 100);
  const stars = accuracy >= 80 ? 3 : accuracy >= 60 ? 2 : accuracy >= 40 ? 1 : 0;
  return { correctCount, totalQuestions, accuracy, totalTime, stars };
}

/**
 * 工具方法：按 ID 查找题目（错题本展示用）
 */
export function findQuizQuestionById(id: string): QuizQuestion | null {
  return ALL_QUESTIONS.find(q => q.id === id) || null;
}
