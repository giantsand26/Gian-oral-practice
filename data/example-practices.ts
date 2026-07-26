export type Score = [name: string, score: number | null, level: string];

export type PracticeError = {
  id: string;
  type: string;
  original: string;
  corrected: string;
  reason: string;
  memory: string;
};

export type Sentence = {
  id: string;
  text: string;
  zh: string;
  scene: string;
  phrase: string;
};

export type Practice = {
  id: string;
  date: string;
  displayDate: string;
  time: string;
  topic: string;
  cefr: string;
  overall: number | null;
  scores: Score[];
  summary: string;
  errors: PracticeError[];
  sentences: Sentence[];
  sourceTurnId: string;
  receivedAt?: string;
};

// These records are fictional and exist only to demonstrate the interface.
export const practices: Practice[] = [
  {
    id: "demo-learning-habit",
    date: "2026-07-03",
    displayDate: "July 3, 2026",
    time: "19:30",
    topic: "Building a consistent learning habit",
    cefr: "B1+ → B2",
    overall: 7.6,
    scores: [
      ["Fluency", 7.5, "B2"],
      ["Grammar", 7.0, "B1+"],
      ["Vocabulary", 7.5, "B2"],
      ["Pronunciation", 7.5, "B2"],
      ["Content", 8.5, "B2"],
    ],
    summary:
      "You explained your learning plan clearly and supported it with practical examples. Focus next on article use and smoother transitions between ideas.",
    errors: [
      {
        id: "demo-habit-e1",
        type: "Grammar · Article",
        original: "I want to build consistent habit.",
        corrected: "I want to build a consistent habit.",
        reason: "A singular countable noun normally needs an article.",
        memory: "build a consistent habit",
      },
      {
        id: "demo-habit-e2",
        type: "Expression · Natural phrasing",
        original: "I will insist doing it every day.",
        corrected: "I will keep doing it every day.",
        reason: "Use “keep doing” when you mean continuing an activity.",
        memory: "keep doing something",
      },
    ],
    sentences: [
      {
        id: "demo-habit-s1",
        text: "Small actions become powerful when I repeat them consistently.",
        zh: "当我持续重复时，小行动也会产生强大的力量。",
        scene: "谈论习惯",
        phrase: "repeat consistently",
      },
      {
        id: "demo-habit-s2",
        text: "My goal is to make practice part of my daily routine.",
        zh: "我的目标是让练习成为日常生活的一部分。",
        scene: "表达学习目标",
        phrase: "part of my daily routine",
      },
    ],
    sourceTurnId: "fictional-demo-turn-learning-habit",
  },
  {
    id: "demo-travel-plan",
    date: "2026-07-02",
    displayDate: "July 2, 2026",
    time: "12:45",
    topic: "Planning a weekend trip",
    cefr: "B1 → B1+",
    overall: 7.1,
    scores: [
      ["Fluency", 7.0, "B1+"],
      ["Grammar", 6.5, "B1"],
      ["Vocabulary", 7.0, "B1+"],
      ["Pronunciation", 7.0, "B1+"],
      ["Content", 8.0, "B2"],
    ],
    summary:
      "You compared several travel options and gave clear reasons for your choice. Continue practicing past-tense consistency and travel collocations.",
    errors: [
      {
        id: "demo-travel-e1",
        type: "Grammar · Tense",
        original: "Last year I go there by train.",
        corrected: "Last year I went there by train.",
        reason: "A finished event in the past needs the simple past.",
        memory: "I went there by train.",
      },
      {
        id: "demo-travel-e2",
        type: "Vocabulary · Collocation",
        original: "take a travel",
        corrected: "take a trip / go on a trip",
        reason: "English normally uses “trip” in this expression.",
        memory: "go on a trip",
      },
    ],
    sentences: [
      {
        id: "demo-travel-s1",
        text: "I would rather take the train because I can enjoy the scenery.",
        zh: "我更愿意坐火车，因为我可以欣赏沿途风景。",
        scene: "比较交通方式",
        phrase: "would rather",
      },
    ],
    sourceTurnId: "fictional-demo-turn-travel-plan",
  },
  {
    id: "demo-book-discussion",
    date: "2026-07-01",
    displayDate: "July 1, 2026",
    time: "08:10",
    topic: "A book that changed my perspective",
    cefr: "B1",
    overall: 6.7,
    scores: [
      ["Fluency", 6.5, "B1"],
      ["Grammar", 6.0, "B1"],
      ["Vocabulary", 7.0, "B1+"],
      ["Pronunciation", 6.5, "B1"],
      ["Content", 7.5, "B1+"],
    ],
    summary:
      "You communicated the main idea and your personal reaction successfully. Shorter sentences and clearer linking words will make the story easier to follow.",
    errors: [
      {
        id: "demo-book-e1",
        type: "Grammar · Verb pattern",
        original: "It made me to think differently.",
        corrected: "It made me think differently.",
        reason: "Use the base verb without “to” after “make + object.”",
        memory: "make someone think",
      },
    ],
    sentences: [
      {
        id: "demo-book-s1",
        text: "The book encouraged me to look at the problem from another angle.",
        zh: "这本书鼓励我从另一个角度看待问题。",
        scene: "分享阅读感受",
        phrase: "from another angle",
      },
    ],
    sourceTurnId: "fictional-demo-turn-book-discussion",
  },
];
