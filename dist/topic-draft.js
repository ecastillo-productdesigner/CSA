const cleanTitle = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const indexValue = value => Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
const earlyVoting = /early vot|absentee|mail[- ]in ballot|vote by mail|voting (?:hours|locations|sites)/i;

function momentumTitles(headline) {
  const region = /north carolina|\bn\.?c\.?\b/i.test(headline) ? 'North Carolina ' : '';
  const party = /democrat/i.test(headline) ? 'Democrats' : /republican/i.test(headline) ? 'Republicans' : '';
  if (!party) return ['Early Voting Opens a New Test of Turnout and Momentum', 'What the Early Voting Picture Could Mean for the Campaign Ahead', 'The Political Questions Behind the First Wave of Early Votes'];
  const subject = `${region}${party}`;
  const positive = /strong|lead|ahead|surge|boost|optimis|encourag/i.test(headline) && !/\bnot\b|\bno\b|trail|weak|slow|poor|behind/i.test(headline);
  return [
    positive ? `Early Voting Gives ${subject} a Reason for Optimism` : `What Early Voting Could Mean for ${subject}`,
    `The Early Voting Test Facing ${subject}`,
    `${subject} and the Unfinished Story of Early Turnout`,
  ];
}

const topics = [
  {
    matches: headline => earlyVoting.test(headline) && /turnout|strong start|democrat|republican|momentum|campaign|lead|ahead|surge/i.test(headline),
    titles: momentumTitles,
    shareText: 'An encouraging opening can lift a campaign’s mood, but early participation offers only part of the election picture.',
    openings: ['the political momentum suggested by the first stretch of early voting', 'the gap between an encouraging early-voting start and the longer campaign ahead', 'the competing expectations that can form around the first wave of early votes'],
    paragraphs: [
      'A strong early start can give a party something valuable beyond the immediate numbers: a sense of energy. Campaigns look for signs that supporters are engaged and that their organizing efforts are reaching people. An encouraging opening could help sustain that enthusiasm through the remaining voting period.',
      'The first wave of participation still leaves much of the picture unfinished. Some voters prefer to act early, while others wait until later. A burst of activity can shape expectations without establishing how every part of the electorate will take part or how the final balance will look.',
      'That uncertainty creates a familiar tension between momentum and perspective. Supporters may see an early advantage as evidence of growing confidence; a more cautious reading asks whether the pattern can continue. Both reactions keep attention on the days ahead rather than treating the opening stretch as a completed result.',
      'The larger story is whether an encouraging beginning can become durable participation. For campaigns, the opportunity would be to maintain engagement without confusing optimism with an outcome. For everyone watching, the next stage of early voting would add context to an opening that remains only one part of the election.',
    ],
  },
  {
    matches: headline => earlyVoting.test(headline),
    titles: () => ['The Questions That Shape an Early Voting Plan', 'Making Sense of Early Voting Before Election Day', 'A Clearer Look at Voting Before the Final Day'],
    shareText: 'A closer look at early voting, the practical choices it presents, and the everyday circumstances that shape participation before election day.',
    openings: ['the everyday choices that can make voting before election day appealing', 'the balance between convenience and preparation in an early-voting plan', 'the practical questions surrounding the choice to vote early'],
    paragraphs: [
      'The appeal of early voting can begin with something ordinary: a crowded calendar. Work, family commitments, and transportation can all shape when a person is able to participate. The option to make a plan ahead of the final day can offer a different way to approach those competing demands.',
      'Convenience is not the same for everyone. A location that suits one routine may be difficult for another, and a preferred time may depend on other responsibilities. The practical value lies in understanding the available local options and comparing them with the circumstances of the person making the choice.',
      'Clear information makes those decisions easier to organize. Applicable dates, locations, and procedures give a plan its structure, while unanswered questions can be directed to the relevant election office. The useful details are local and current, rather than assumed from another place or a previous election.',
      'The result is a more manageable view of participation before election day. The story is less about finding one ideal routine than about understanding the choices and making room for them. Each person’s circumstances would shape the plan that works for them.',
    ],
  },
  {
    matches: /election|ballot|candidate|campaign|congress|senat|governor|mayor|president|voter|politic|city council/i,
    titles: () => ['The Political Questions That Reach Beyond a Single Headline', 'What the Latest Political Debate Could Mean for the Road Ahead', 'The Context Shaping a New Political Conversation'],
    shareText: 'The expectations, public questions, and unfinished context shaping the political conversation as the wider debate continues to develop.',
    openings: ['the public questions and competing expectations behind the political story', 'the tension between a political development and the expectations that follow it', 'the wider debate that can grow around a political headline'],
    paragraphs: [
      'A political development can carry more than one meaning for the people following it. Supporters may see an opportunity, critics may focus on the unresolved questions, and people outside that immediate debate may want to know how the issue connects with everyday concerns.',
      'The process matters as much as the reaction. A proposal, a campaign statement, a public decision, and an election result represent different stages of a story. Keeping those distinctions visible gives the debate a clearer shape without assuming that the first announcement settles what happens next.',
      'The conversation can also change as more context becomes available. Public records and clearly attributed positions offer a firmer basis for comparison than expectations alone. The central question is how the issue develops and which parts of the discussion prove most significant over time.',
      'The political story remains connected to the people and decisions affected by it. Beyond the immediate response, attention would turn to the next stage of the process and the questions that remain open. That is where a single development becomes part of a wider public conversation.',
    ],
  },
  {
    matches: /court|lawsuit|charged|arrest|trial|police|investigation|crime|shooting/i,
    titles: () => ['The Unanswered Questions at the Center of a Developing Case', 'Understanding the Next Chapter in a Legal Story', 'The Context Behind a Legal Development'],
    shareText: 'The process, public questions, and unresolved context surrounding a developing legal or public-safety story and the next stage ahead.',
    openings: ['the public questions surrounding a developing legal or public-safety story', 'the distinction between a new legal development and a final resolution', 'the process that can unfold beyond the initial legal headline'],
    paragraphs: [
      'A development in a case can attract attention before the wider picture is clear. The significance depends in part on the stage of the process: an allegation, an investigation, a filing, and a court decision carry different meanings.',
      'That distinction shapes how the story unfolds. A new document may explain one part of a dispute while leaving other questions open. Public interest can grow around those gaps, even when the available record does not yet offer a complete account.',
      'Careful attribution keeps the different parts of that record in perspective. A statement made in a filing is different from a finding by a court. Understanding who is making a claim and where it sits in the process helps prevent an early development from being mistaken for a final answer.',
      'The next procedural step would provide another point of context. Until then, the central legal question and the information available to address it remain the focus, without speculating about personal motives or an outcome that has not been established.',
    ],
  },
  {
    matches: /hurricane|tornado|storm|flood|weather|forecast|heat wave|snow|wildfire/i,
    titles: () => ['The Weather Questions That Could Shape the Days Ahead', 'A Changing Forecast Brings Everyday Plans Into Focus', 'The Bigger Picture Behind a Weather Headline'],
    shareText: 'Timing, uncertainty, and everyday decisions give the weather story its wider significance as the picture continues to develop.',
    openings: ['the uncertainty and everyday decisions surrounding a weather story', 'the way a developing weather picture can bring ordinary plans into focus', 'the practical questions that arise while a weather situation continues to develop'],
    paragraphs: [
      'Weather becomes personal when it intersects with the ordinary shape of a day. A journey, an outdoor event, or a familiar routine can take on a different significance when conditions may change. The concern is often as much about timing as the weather itself.',
      'Location adds another layer to that uncertainty. A broad forecast does not describe every place in the same way, and the period covered by an update matters. The details give a weather report its scale and explain why nearby communities may be following different questions.',
      'As the picture develops, attention can shift from the first impression to the next update. New information provides context for decisions that may have seemed straightforward earlier. That makes the source and time of an update part of the story rather than a detail at its edge.',
      'The wider theme is how people respond to uncertainty while keeping daily life moving. An evolving weather situation can bring those choices into focus, with the latest relevant information offering a clearer view of what remains possible and what still needs to be watched.',
    ],
  },
  {
    matches: /football|basketball|baseball|soccer|hockey|tennis|playoff|touchdown|championship|athlete|coach|tournament|sports/i,
    titles: () => ['The Sporting Story Behind the Latest Expectations', 'A New Test of Preparation, Pressure, and Possibility', 'What Comes Next in a Developing Sports Story'],
    shareText: 'Preparation, expectations, and the questions beyond a single moment give the sporting story its wider interest.',
    openings: ['the expectations and open questions surrounding the sporting story', 'the balance between preparation and pressure in a sporting moment', 'the wider significance a sporting development can take on for an audience'],
    paragraphs: [
      'Sporting interest often extends beyond the moment that first draws attention. A result, a roster question, or a preview can become a way to think about preparation, opportunity, and the expectations surrounding a competition.',
      'Those expectations can look different from one perspective to another. Supporters may focus on possibility, while a more cautious view considers the questions still to be answered. That tension gives the story room to develop beyond a single prediction.',
      'Context turns an isolated development into a wider narrative. Comparisons over time, the demands of a competition, and the difference between expectation and performance all shape how an audience understands what is at stake.',
      'The next stage would offer another chance to test those expectations. Until then, the appeal lies in the mix of preparation and uncertainty that keeps a sporting story open, without assuming a result before it has happened.',
    ],
  },
  {
    matches: /celebrity|relationship|actor|actress|movie|film|television|\btv\b|\bshow\b|series|music|singer|musician|album|concert|pop.culture|entertainment/i,
    titles: () => ['The Entertainment Story Behind the Growing Conversation', 'A New Perspective on a Familiar Entertainment Topic', 'The Questions Keeping an Entertainment Story in Focus'],
    shareText: 'Audience interest, cultural context, and the questions beyond the headline give the entertainment story room to develop.',
    openings: ['the audience interest and cultural context surrounding the entertainment story', 'the questions that can keep an entertainment topic in the conversation', 'the connection between a familiar entertainment subject and a fresh point of interest'],
    paragraphs: [
      'An entertainment story can draw attention because it connects something new with something an audience already knows. Familiar work, public appearances, and an ongoing cultural conversation can give a headline significance beyond its immediate wording.',
      'Part of the appeal lies in the questions that follow. A screen project invites discussion about the work itself, while a public timeline raises questions about context and continuity. Those different interests can coexist without turning interpretation into a claim about someone’s private intentions.',
      'The strongest thread is often the connection between the subject and the audience following it. People bring their own expectations and memories to an entertainment topic, helping explain why one development can prompt several different conversations.',
      'The wider story would continue to take shape as more public context becomes available. For now, its interest lies in the relationship between a familiar subject, the questions around it, and the place it holds in a broader cultural discussion.',
    ],
  },
  {
    matches: /wellness|health|nutrition|fitness|exercise|sleep|diet|medical|doctor|disease|cancer|dementia|alzheimer/i,
    titles: () => ['The Health Questions That Deserve a Closer Look', 'Finding Context in a Growing Wellness Conversation', 'The Bigger Picture Behind a Wellness Headline'],
    shareText: 'Everyday concerns and the need for context shape the discussion around the health or wellness topic.',
    openings: ['the everyday concerns and open questions surrounding a health topic', 'the gap between an attention-grabbing wellness headline and its wider context', 'the interest a health topic can generate when it connects with ordinary concerns'],
    paragraphs: [
      'Health topics often attract attention because they connect a broad idea with a personal concern. A familiar habit, an experience, or a research discussion can prompt people to reconsider questions they have carried for some time.',
      'Context gives that interest a clearer shape. A personal account and a research finding offer different kinds of information, and the scope of each matters. Understanding what a piece of information describes is part of understanding why it may be significant.',
      'Uncertainty can be as important as the initial impression. Questions about comparison, evidence, and individual circumstances help separate a useful discussion from an assumed conclusion. A broad headline alone does not explain what a topic means for a particular person.',
      'The conversation becomes more useful when it leaves room for those distinctions. The wider value lies in understanding the subject and recognizing which questions require further evidence or qualified guidance, rather than treating general interest as personal medical advice.',
    ],
  },
  {
    matches: /fashion|shopping|shopper|sale|dress|outfit|shoe|beauty|makeup|skincare|wardrobe/i,
    titles: () => ['The Everyday Choices Behind a New Shopping Conversation', 'A Fresh Perspective on Style, Usefulness, and Personal Preference', 'The Practical Questions Behind a Fashion Headline'],
    shareText: 'Personal preference, practical priorities, and everyday use bring the fashion or shopping topic into clearer focus beyond a first impression.',
    openings: ['the everyday choices and personal preferences behind the shopping story', 'the practical appeal a fashion topic can have beyond its first impression', 'the balance between a new style idea and the routines it might fit into'],
    paragraphs: [
      'A fashion or shopping idea can gain interest when it offers a new way to think about something familiar. The appeal might be visual, practical, or simply the possibility of seeing an everyday choice from another angle.',
      'Personal preference gives that idea different meanings. Comfort, intended use, and what someone already owns can all shape the questions they ask. An option that feels fresh to one person may matter less to another.',
      'That is where a broader comparison becomes useful. A trend and a product promotion tell different stories, while everyday usefulness can remain a concern in either one. The topic becomes more interesting when those distinctions are part of the conversation.',
      'The lasting question is how an idea fits into ordinary life. Beyond the first impression, the value would depend on the needs and preferences of the person considering it, leaving room for individual judgment rather than a single answer for everyone.',
    ],
  },
  {
    matches: /econom|business|stock|market|inflation|interest rate|company|companies|bank|jobs|employment|finance|housing/i,
    titles: () => ['The Economic Questions That Reach Into Everyday Life', 'Understanding the Wider Stakes of a Business Development', 'The Context Behind a Changing Business Picture'],
    shareText: 'Scale, expectations, and everyday concerns give the economic or business story its wider significance beyond the first response to a headline.',
    openings: ['the everyday concerns and expectations surrounding an economic story', 'the different ways a business development can be understood', 'the comparisons that give an economic headline its wider significance'],
    paragraphs: [
      'An economic story can look different depending on who is following it. A household, a worker, and a business owner may focus on different questions, even when they are responding to the same broad development.',
      'The scale of a change matters as much as its direction. A comparison can carry different meaning depending on the period, place, or group it describes. Those distinctions help explain why an immediate reaction may be only part of the picture.',
      'Expectations add another layer. People may weigh what a development could mean against the uncertainty that remains, while keeping an announcement separate from its eventual effects. The most useful context connects those expectations with the information actually available.',
      'The wider story is how economic developments intersect with ordinary decisions. Following the comparisons and the questions still open offers a clearer perspective without assuming that every household or business would experience the same effect.',
    ],
  },
];

function generalTitles(headline) {
  const subject = headline.replace(/^(?:a closer look at|a look at|inside|the story behind|understanding)\s+/i, '').replace(/[.!?]+$/, '').split(/[:—–]/)[0].trim();
  const words = subject.split(/\s+/);
  const limit = words.length > 7 ? 7 : subject === headline && words.length > 3 ? words.length - 2 : words.length;
  const phrase = words.slice(0, Math.max(2, limit)).join(' ').replace(/[,;:]$/, '');
  return [`The Wider Story Behind ${phrase}`, `${phrase}: A Different Perspective`, `The Questions Surrounding ${phrase}`];
}

const generalTopic = {
  titles: generalTitles,
  shareText: 'The wider context, everyday connections, and open questions behind the selected article’s central topic bring a new perspective to the conversation.',
  openings: ['the wider conversation surrounding the subject of the selected article', 'the everyday connections that can give a headline broader significance', 'the questions that keep the selected topic open to a closer look'],
  paragraphs: [
    'A single development can become significant because of the questions around it. The first impression may be straightforward, but the wider context can reveal why the subject matters to people approaching it from different perspectives.',
    'Some of that interest comes from everyday connections. A topic can overlap with familiar concerns, existing expectations, or a conversation that has been developing for some time. Those connections give the story depth beyond the moment that first attracted attention.',
    'There can also be a gap between what is immediately visible and what becomes clearer over time. New context may change the emphasis without changing the central subject. That leaves room for the story to develop rather than forcing an early conclusion.',
    'The wider significance lies in that continuing conversation. Returning to the central question brings the different themes together and offers a clearer way to understand why the topic deserves attention beyond a single headline.',
  ],
};

function topicFor(headline) {
  return topics.find(topic => typeof topic.matches === 'function' ? topic.matches(headline) : topic.matches.test(headline)) || generalTopic;
}

export function fictionalTopicParagraphs(title, { revision = 0, relatedTitles = [] } = {}) {
  const headline = cleanTitle(title) || 'the selected article';
  const topic = topicFor(headline);
  const index = indexValue(revision);
  const opening = `This imagined account, inspired by “${headline}”, explores ${topic.openings[index % topic.openings.length]}.`;
  const middle = topic.paragraphs.slice(0, -1);
  const rotation = index % middle.length;
  const paragraphs = [opening, ...middle.slice(rotation), ...middle.slice(0, rotation), topic.paragraphs.at(-1)];
  const related = [...new Set(relatedTitles.map(cleanTitle).filter(value => value && value !== headline))].slice(0, 2);
  if (related.length) paragraphs[paragraphs.length - 1] += ` The related ${related.length === 1 ? 'story' : 'stories'} ${related.map(value => `“${value}”`).join(' and ')} ${related.length === 1 ? 'adds' : 'add'} another point of context to that conversation.`;
  return paragraphs;
}

export function topicDraftContent(sources, { revision = 0, variant = 0 } = {}) {
  const headlines = (Array.isArray(sources) ? sources : [])
    .filter(source => source && source.selected !== false && (source.type === 'link' || typeof source.url === 'string'))
    .map(source => cleanTitle(source.title))
    .filter(title => title && !/^(?:article\s*)?\d+$/i.test(title) && !/^https?:\/\//i.test(title));
  if (!headlines.length) return null;
  const headline = headlines[0];
  const topic = topicFor(headline);
  const titles = topic.titles(headline);
  const choice = (indexValue(variant) + indexValue(revision)) % titles.length;
  let title = titles[choice];
  if (title.toLocaleLowerCase() === headline.toLocaleLowerCase()) title = titles[(choice + 1) % titles.length];
  return { title, shareText: topic.shareText, paragraphs: fictionalTopicParagraphs(headline, { revision, relatedTitles: headlines.slice(1) }) };
}
