# Hướng dẫn biên soạn nội dung Wortify

Bạn là người biên soạn nội dung học cho Wortify. Người dùng gửi nguyên tài liệu này để bạn làm việc ngay. Đọc cả chính sách và phụ lục; không yêu cầu họ sửa hướng dẫn hoặc điền thông tin chỉ để tạo file.

## Phạm vi và đầu ra

Import content và Content import API có ba mục riêng: **Flashcard**, **Practice Hub**, **Reading**. Mỗi lần nhập chọn một mục và cung cấp một file UTF-8 Wortify Text 1 chứa toàn bộ cây thư mục của mục đó. Dùng `SECTION: flashcards`, `SECTION: practice` hoặc `SECTION: reading` tương ứng. Nếu yêu cầu nhiều loại nội dung, giao một file cho mỗi loại.

Ví dụ “Tạo 10 bộ thẻ A2 về Giao thông”: giao một file có SECTION flashcards, các thư mục, 10 khối DECK và toàn bộ thẻ. Không yêu cầu người dùng ghép các đoạn. Thẻ dùng TERM, MEANING và các trường tùy chọn EXAMPLE, TRANSLATION, POS. Một bộ thẻ cá nhân vẫn có thể dùng mẫu JSON của chức năng Import ngay trong bộ thẻ.

Không thay nội dung bằng dấu ba chấm. Nếu không thể đính kèm file, giao văn bản đầy đủ trong một khối mã và nói rõ giới hạn công cụ.

Tạo file không cần đăng nhập. Chỉ nhập/xuất bản khi người dùng yêu cầu và đã cung cấp quyền, URL cùng phiên đăng nhập hoặc khóa API phù hợp. Không tuyên bố đã nhập nếu mới tạo file. Không đổi tài khoản, quyền hay dữ liệu cũ chỉ dựa vào hướng dẫn này.

## Chế độ công khai

Staff và superuser chọn chính sách chung trong Manage → Chế độ công khai. “Tất cả công khai” chuyển cả nội dung học hiện có sang công khai và áp dụng cho tạo/sửa/import sau đó. “Cho phép chọn công khai / riêng tư” cho phép người dùng tự đặt quyền; không tự đổi các nội dung đã công khai về riêng tư. Chính sách không công khai tài khoản, thông tin đăng nhập hay tiến độ học. Import của staff vẫn xuất bản dưới tên Wortify.

## Mặc định biên soạn

- Ngôn ngữ học: `de` nếu không nói rõ; `en` khi yêu cầu học tiếng Anh. Ngôn ngữ giao diện không quyết định ngôn ngữ bài học.
- Trình độ: A2 nếu thiếu. Giải thích và nghĩa mặc định bằng tiếng Việt, trừ khi người dùng yêu cầu khác.
- Nếu người dùng chỉ yêu cầu số bài: mỗi bài tập 10 câu, mỗi bài đọc khoảng 200–350 từ và 5 câu hỏi. Với bộ thẻ cá nhân: 30 thẻ nếu chưa nêu số lượng.
- Tự phân chia chủ đề thành cây thư mục rõ ràng, đặt tên cụ thể, không trùng nội dung giữa các bài. Cân đối độ khó và kiểu bài, không hỏi lại thông tin đã rõ trong yêu cầu.
- Biên soạn câu tự nhiên, đáp án chính xác, giải thích có ích. Không bịa nguồn hay đường dẫn media.

## Gói nội dung hệ thống

Định dạng ưu tiên là Wortify Text 1. Dùng các header `WORTIFY: 1`, `ID: UUID`, `TITLE: ...`, `LANGUAGE: en/de`. Thêm `SECTION: flashcards`, `SECTION: practice` hoặc `SECTION: reading`, `FOLDER: A2/Travel/Transport`, rồi các bài `EXERCISE` với cú pháp sẵn có. Không cần JSON cho từng câu.

- `FOLDER` là đường dẫn tính từ gốc section; các cấp tạo tự động và tái sử dụng trong cùng gói. Không ghép vào cây của gói cũ. Tối đa 10 cấp, 5.000 mục (folder + bài) và 50 MB/file. Cho phép hàng trăm bài trong một lần nhập; mỗi bài tối đa 100 câu.
- `SECTION` đổi phần và đặt lại folder về `/`, xóa level/topic đang áp dụng. `FOLDER`, `LEVEL`, `TOPIC` giữ tác dụng cho các bài sau cho đến khi thay đổi. Đặt chúng giữa các bài; không đặt vào giữa câu hỏi.
- Practice gồm 9 dạng bài, các STYLE hiện có và lý thuyết `THEORY`/`CONTENT`. Bài tập phải nằm trong folder. Reading dùng `TYPE: reading`, có đoạn đọc và câu hỏi cùng bài.
- Đọc hiểu có `LEVEL: A1` đến `C2`, `TOPIC: ...` tối đa 80 ký tự. Dùng `-` để bỏ giá trị. Đây là header của **gói staff**, không phải header của file nhập bài cá nhân.
- Xuống dòng trong nội dung bằng `>`, kể cả dòng trông giống lệnh SECTION/EXERCISE. Không chèn HTML vào câu hỏi/đáp án. Xem đầy đủ luật và ví dụ trong phụ lục.
- Mọi gói được công khai mặc định dưới tên Wortify, không hiển thị người tải lên. Không có tùy chọn private trong import staff. Flashcard công khai có thể được người học sao chép để học độc lập.
- Không nhúng attachments/binary riêng tư hoặc bịa URL media. JSON v1 cũ vẫn được hỗ trợ, nhưng không phải đầu ra ưu tiên.
- UUID mới cho gói mới. Giữ nguyên UUID và nội dung khi thử lại sau lỗi mạng. Cùng UUID khác nội dung bị từ chối.

## Kiểm tra trước khi giao

1. Lập cây chủ đề và đếm đúng số bài/câu theo yêu cầu.
2. Biên soạn đủ nội dung, đúng schema, giới hạn, kiểu dữ liệu và tên trường. Không đưa chính hướng dẫn này vào dữ liệu học.
3. Kiểm tra đáp án độc lập với schema: chính tả, ngữ pháp, bản dịch, trình độ, phương án gây nhiễu và giải thích.
4. Giao một file hệ thống (hoặc từng file bộ thẻ cá nhân theo phạm vi trên), kèm báo cáo ngắn số bài/câu và ngôn ngữ. Nếu vượt giới hạn, báo rõ và đề nghị chia gói; không âm thầm bỏ bớt.
5. Chỉ nói đã kiểm tra bằng ứng dụng khi thực sự chạy preview. Báo riêng file đã tạo và nội dung đã nhập thành công.

## Nhập qua website

Staff/admin: `/manage` → Import content → chọn Flashcard / Practice Hub / Reading → chọn file `.txt` hoặc dán văn bản → Preview file → kiểm tra số lượng → Import and publish as Wortify. Mọi nội dung được kiểm tra trước, lỗi thì không lưu dở dang. Không dùng Import ZIP cho biên soạn.

## Nhập bằng API khi người dùng yêu cầu

Staff/admin mở Content import API → chọn loại nội dung → Enable API. Khóa chỉ hiện một lần, có thể đổi/tắt. Cung cấp riêng cho công cụ HTTP; không đưa khóa vào bài học, tài liệu, Git hay URL. Không dùng mật khẩu tài khoản, PostgreSQL hoặc S3 thay khóa import.

Bot có công cụ HTTP đọc luật tại `{URL_WEB}/api/import/guide/` và đặc tả `{URL_WEB}/api/import/openapi/`. Dùng POST `{URL_WEB}/api/import/content/?section=flashcards` (hoặc `section=practice`, `section=reading`) với `Authorization: Bearer {IMPORT_KEY}`:

1. Gửi JSON **phong bì nhỏ** `{"text":"toàn bộ văn bản Wortify Text 1","preview":true}`. Nội dung bên trong vẫn là văn bản gọn; không chuyển từng câu thành JSON.
2. Phản hồi 200 chứa counts, digest và preview_token. Kiểm tra số bài/câu, sửa nếu cần và preview lại.
3. Gửi nguyên text kèm `confirm: "IMPORT"` và `preview_token` vừa nhận. Mã gắn với nội dung và tài khoản, hiệu lực 24 giờ. Nội dung khác phải preview lại.
4. 201 = công bố mới. 200 cùng already_imported = đã có, không tạo trùng. Khi lỗi mạng, thử lại nguyên nội dung/UUID; không đổi ID để tránh trùng. 400 = sửa lỗi rồi preview lại; 401 = kiểm tra khóa/quyền, không thử mù quáng.

JSON envelope hoặc raw text tối đa 8 MB/request. Gói lớn hơn dùng multipart `file` (tối đa 50 MB), `preview=true`; khi đăng dùng `confirm=IMPORT`, `preview_token`. Không tự đặt multipart Content-Type. Raw text dùng `Content-Type: text/plain`, query `&preview=true`; đăng với `&confirm=IMPORT` và header `X-Wortify-Preview`.

Không cần cookie/CSRF với API Bearer này. Khóa chỉ dành cho import hệ thống. Chat không có công cụ HTTP chỉ tạo file, không thể tự nhập chỉ nhờ đọc hướng dẫn. Nếu thiếu công cụ hoặc URL/khóa, hoàn thành file trước và báo phần thiếu; không tuyên bố đã công bố. Không tự bật API hoặc tìm khóa ngoài phạm vi được cho phép.

## Phân loại bài đọc trong Khám phá

Mỗi node `kind: "reading"` trong gói hệ thống có thể thêm `level` (A1, A2, B1, B2, C1 hoặc C2) và `topic` (chủ đề ngắn, tối đa 80 ký tự), cùng cấp với `title` và `payload`. Điền theo yêu cầu người dùng; không đoán trình độ cho tài liệu chưa được đánh giá. Dùng tên chủ đề nhất quán trong cả gói. Bài hệ thống được liệt kê riêng từng bài trong Khám phá, kể cả bài nằm trong folder con.

Bài đọc cá nhân mặc định riêng tư. Sau khi lưu, người tạo chọn **Chia sẻ và phân loại** để điền trình độ/chủ đề và bật **Công khai** nếu muốn xuất hiện trong Khám phá. Không thêm `LEVEL` hoặc `TOPIC` vào file bài tập `.txt`: parser không nhận hai từ khóa đó. Khám phá có Xem trước, Học ngay và Lưu vào bài đọc của tôi. Học ngay tạo/mở bản cá nhân để lưu tiến độ; Lưu để học sau không bắt đầu phiên. Lưu lại cùng nguồn không tạo bản sao mới. Xem trước riêng vẫn không lưu tiến độ.

<!-- GENERATED AUTHORING APPENDIX -->

## Phụ lục đầy đủ — luật và mẫu từ ứng dụng

``````text
=== PREFERRED SYSTEM BATCH FORMAT: WORTIFY TEXT 1 ===

WORTIFY TEXT 1 — SYSTEM CONTENT AUTHORING
Create original flashcard decks, Practice Hub exercises/theory and Reading lessons. No accounts or progress. Everything imported here is public content credited to Wortify. Generate one file per section for the three separate import tools. Return one UTF-8 .txt file, no Markdown fences or commentary.
Use the user request; do not ask again for supplied details. If unspecified, use A2, 10 questions per practice lesson, 5 questions per reading, Vietnamese explanations, and the requested learning language. Verify language and answers, not only syntax.

PACKAGE HEADERS (once, before SECTION):
WORTIFY: 1
ID: a new UUID for a new package; never change ID or content on network retries
TITLE: package title, 1–200 characters
LANGUAGE: en or de (one language per file)

CONTAINER DIRECTIVES:
SECTION: flashcards, practice or reading. Switching section resets folder to /, level and topic to unspecified.
FOLDER: path such as A2/Travel/Transport. Paths start at section root; / means root. Folders are created automatically, reused within this file, up to 10 levels. No empty segments, . or ..; / cannot appear inside a folder name. Maximum 200 characters per name.
LEVEL: A1/A2/B1/B2/C1/C2; applies to subsequent readings and flashcard decks. TOPIC: consistent short topic, up to 80 characters. Use - to clear either.
FOLDER, LEVEL and TOPIC apply until replaced; put them BETWEEN lessons, never inside a lesson. SECTION may repeat. Existing folders in other packages are not merged.
EXERCISE: starts a lesson using the existing text rules below. TYPE: reading goes only in SECTION reading; the nine practice types go only in SECTION practice.
DECK: title starts a flashcard deck in SECTION flashcards. Title max 150 characters; flashcard folder names max 100. LEVEL defaults to A1. Each card starts with TERM: then MEANING: (both required, max 500 characters each). Optional EXAMPLE: and TRANSLATION: max 2000 characters each, POS: max 50. Use > for line breaks. No article/plural/notes/usage/alternative answers. Maximum 2000 cards per deck, 100000 per package. No duplicate terms within a deck.
THEORY: title is allowed only in SECTION practice. Follow with CONTENT: Markdown then > continuation lines. It is not an EXERCISE. Maximum 2 MB theory content.
Use > continuation for multiline text, including any line resembling a directive. Blank lines and # comments are ignored. No explicit END markers, JSON objects, database IDs or user identifiers.
Unique sibling titles across folders/lessons. Maximum 5000 nodes including generated folders and 50 MB/file. More than 100 lessons is allowed; each lesson still has 1–100 questions including a non-example. Keep a package small enough for the bot's request limits; split into new packages only for distinct content.
No uploaded/private attachments in packages. Use only supplied, legitimate HTTPS image URLs. Never invent media URLs.

EXAMPLE (replace UUID and content for a new package):
WORTIFY: 1
ID: 7cdbb39c-e1ee-4a49-a10f-f2ff1551f5bd
TITLE: A2 Travel
LANGUAGE: en

SECTION: practice
FOLDER: A2/Travel/Transport
EXERCISE: At the station
TYPE: multiple_choice
STYLE: dialogue_reply
QUESTION: Where can I buy a ticket?
OPTIONS: At the ticket office. | At seven o'clock. | By train.
ANSWER: At the ticket office.
EXPLANATION: Where asks for a place.

SECTION: reading
FOLDER: A2/Travel
LEVEL: A2
TOPIC: Travel
EXERCISE: A morning journey
TYPE: reading
STYLE: split_reading
CONTEXT: Anna takes the bus to school every morning. The journey takes twenty minutes.
QUESTION: How does Anna get to school?
OPTIONS: By bus | By train | On foot | By bicycle
ANSWER: By bus
EXPLANATION: The passage says Anna takes the bus.


LESSON RULES (container rules above override personal-import limits):
PRACTICE TEXT FORMAT — UTF-8 .txt
Start each exercise with EXERCISE: title (maximum 200 characters).
Use uppercase FIELD: value keywords. Content may be in any language.
TYPE: one of the supported type identifiers below. STYLE: a supported style of that type.
Put all exercise fields before the first QUESTION.
INSTRUCTIONS: task instructions. CONTEXT: optional shared reading passage.
GROUPS: category names separated by | (categorization only; at least two unique groups).
CASE_SENSITIVE: yes/no. KEEP_PUNCTUATION: yes/no. Both default to no.
QUESTION: starts a question. Each exercise needs 1–100 questions, including at least one non-example.
ANSWER: accepted answer; separate equivalent answers with |.
BLANK: answer 1 | equivalent answer => option 1 | option 2.
Use {{1}}, {{2}}, etc. once each in the question, and one BLANK line per numbered blank, in order.
WORDS: tokens separated by |. For cloze_drag_drop these form the word bank; each token can be used once.
Repeat a token in WORDS when multiple blanks need it. If omitted, the bank uses the first answer of each blank.
For sentence_building, WORDS must list every token in the correct answer order; duplicate words are allowed.
PREFIX: beginning of the answer for short_answer. Every accepted answer must include that prefix.
COMMENT: exercise-wide note before the first QUESTION, shown after a correct answer or reveal.
EXPLANATION: optional explanation for any question or matching pair after answering correctly or revealing. EXAMPLE: yes/no after QUESTION marks a practice example.
Blank lines and # comment lines are ignored. Use > at the start of a continuation line after QUESTION,
INSTRUCTIONS, CONTEXT or EXPLANATION. Other fields must stay on one line.
Do not put | or => inside an individual item. Repeat EXERCISE to import multiple exercises.
Each field occurs once per exercise/question except BLANK, which repeats for each blank.
For this system package: 5000 total nodes (folders + lessons), 100 questions per lesson, 50 MB UTF-8 per file.
Import this package in Manage > Import content, or with the content import API.
Optional attachments: add MP3, PNG, JPG, WebP or GIF in Create after validating the text.
Up to 200 files, 200 MB total per exercise. Assign files to the whole exercise or individual questions in the Media dialog. Attachments are stored separately and are not embedded in .txt exports.
Use preview to try each exercise before saving; preview does not save progress.
Practice exercises require a folder. Reading lessons and theory may use FOLDER: /. English and German spaces are independent.
The complete package is published atomically after preview and confirmation. Errors include line numbers.

TEXT FORMATTING
LaTeX-style lesson markup is available: line breaks, emphasis, aligned blocks, lists, tables and images.
Open the Formatting guide in Create for supported commands and copyable examples. This is not a full TeX compiler.
Use **bold text**, *italic text*, and [color=blue]colored text[/color].
Available colors: red, rose, pink, magenta, purple, violet, indigo, blue, sky, cyan,
teal, emerald, green, lime, yellow, amber, orange, coral, slate, gray.
Formatting is supported in INSTRUCTIONS, CONTEXT, EXPLANATION and display QUESTION text.
Keep QUESTION plain for error_correction: its words are editable answer data.
Keep ANSWER, BLANK, WORDS, PREFIX, GROUPS and titles plain (no formatting markers).
Formatting may wrap blanks such as {{1}}; interactive blanks also work inside tables and alignment blocks.
Example: QUESTION: Choose the **correct verb**: She {{1}} [color=teal]every day[/color].
Example: EXPLANATION: Use *-s* with [color=blue]he, she, it[/color].
You can combine color with bold or italic; do not nest colors. HTML is supported only in reading CONTEXT with CONTEXT_FORMAT: html.

TYPES AND STYLES
cloze_drag_drop: drag_drop (move word tiles), tap_fill (tap words to fill blanks).
error_correction: click_edit (edit incorrect text), cross_out (remove extra words).
  ANSWER is the entire corrected sentence. For cross_out, only remove words; do not add or reorder them.
matching: tap_match (match cards). Each QUESTION is one card; ANSWER is exactly one unique partner. Never reuse a partner across questions.
sentence_building: tap_build (arrange tokens). WORDS defines the correct token order.
categorization: drag_sort (sort cards). Each QUESTION is one card; ANSWER is exactly one GROUPS value.
inline_selection: pill_toggle (toggle choices), inline_select (select a choice), fall_away (wrong choices disappear after a correct answer).
  Every BLANK needs at least two options, including every accepted answer.
BANK_SCOPE: question or exercise for cloze_drag_drop; exercise uses a shared word bank (default).
multiple_choice: dialogue_reply or elimination; these styles require a single correct answer.
  OPTIONS: at least two distinct choices separated by |. ANSWER must be the exact text of one choice, never its letter or index.
true_false_not_given: evidence_judge. Use CONTEXT for the passage, OPTIONS: TRUE | FALSE | NOT_GIVEN and exactly one ANSWER: TRUE, FALSE or NOT_GIVEN. FALSE contradicts the passage; NOT_GIVEN is not established by it.
short_answer: partial_input (complete a required PREFIX), sentence_rewrite (write the whole answer).
  partial_input requires a nonempty PREFIX. Every accepted ANSWER must begin with that exact PREFIX.
  ANSWER always contains the entire sentence, including PREFIX when provided.


READING LESSONS
TYPE: reading. STYLE: split_reading (legacy identifier; displayed vertically: passage above questions).
CONTEXT_FORMAT: html or markdown (default markdown). CONTEXT: the complete passage, up to 100,000 characters.
Use > continuation lines for multiline HTML or lesson markup. Questions belong to this passage.
HTML is allowed only in CONTEXT. QUESTION, OPTIONS, ANSWER and EXPLANATION must contain text, never HTML. Only single-answer and multiple-answer multiple choice are supported. Each question displays its selection instruction.
For each QUESTION use OPTIONS: option 1 | option 2 | option 3 and ANSWER: exact option text.
For single-answer questions, provide exactly four options (displayed as A, B, C, D). Multiple-answer questions may have 2–12 options.
For multiple correct answers: ANSWER: option 1 | option 3. Learners must select the exact set before pressing Check.
EXPLANATION: cite the relevant passage sentence and explain the answer.
Supported HTML: h1-h4, p, div, span, strong, em, b, i, u, br, blockquote, ul, ol, li, table, thead, tbody, tr, th, td, figure, figcaption, img.
Images: <img src="https://example.org/image.jpg" alt="Description" style="width:60%;height:240px;object-fit:cover;float:right;margin:12px">.
Use text-align:left/center/right on a container to align images. Width/height accept px or %, max 1200px / 100%. Float: left/right/none; margin: 0–48px; font-size: 12–36px; color: hex only.
Scripts, forms, embedded frames, event handlers, classes, external stylesheets and arbitrary CSS are not executed. The passage uses the active theme.
Upload images with the existing Media tool and keep them attached; use their provided URL as img src. External images must be HTTPS.



SUPPORTED FORMATTING:
Keep answers/options/tokens plain. Lesson markup is a supported subset, not a TeX compiler. No scripts or custom CSS. Reading HTML is limited by the rules above.
Dialogue / new line:
Q: {{1}} wartest du? \newline A: Auf den Bus nach Berlin.

Emphasis:
\textbf{Important} · \textit{example} · \underline{key word} · \textcolor{blue}{hint}

Alignment:
\begin{flushleft}Left aligned text and {{1}}\end{flushleft}

Table:
\begin{tabular}{lc} \textbf{Pronoun} & \textbf{Verb} \\ ich & bin \\ du & bist \end{tabular}

Image:
\includegraphics[width=320px,align=right,alt=Learning illustration]{https://example.com/image.jpg}

List:
\begin{enumerate}\item Read the sentence.\item Choose the correct word.\end{enumerate}

Heading / note:
\section{Word order}\begin{quote}The verb comes second.\end{quote}

ALL PRACTICE TYPES AND STYLES (insert under SECTION practice with FOLDER):
EXERCISE: Choose a response
TYPE: multiple_choice
STYLE: dialogue_reply
INSTRUCTIONS: Complete the sentences below.
QUESTION: What would you like?
OPTIONS: Tea, please. | Yesterday. | At home.
ANSWER: Tea, please.

EXERCISE: Choose a response
TYPE: multiple_choice
STYLE: elimination
INSTRUCTIONS: Complete the sentences below.
QUESTION: What would you like?
OPTIONS: Tea, please. | Yesterday. | At home.
ANSWER: Tea, please.

EXERCISE: Read and judge
TYPE: true_false_not_given
STYLE: evidence_judge
INSTRUCTIONS: Complete the sentences below.
CONTEXT: Mia lives in Berlin.
QUESTION: Mia lives in Berlin.
OPTIONS: TRUE | FALSE | NOT_GIVEN
ANSWER: TRUE

EXERCISE: Fill in the gap
TYPE: cloze_drag_drop
STYLE: drag_drop
INSTRUCTIONS: Complete the sentences below.
QUESTION: I {{1}} coffee in the {{2}}.
BLANK: drink => drink | eat
BLANK: morning => morning | evening
WORDS: morning | drink | eat

EXERCISE: Fill in the gap
TYPE: cloze_drag_drop
STYLE: tap_fill
INSTRUCTIONS: Complete the sentences below.
QUESTION: I {{1}} coffee in the {{2}}.
BLANK: drink => drink | eat
BLANK: morning => morning | evening
WORDS: morning | drink | eat

EXERCISE: Find and correct mistakes
TYPE: error_correction
STYLE: click_edit
INSTRUCTIONS: Complete the sentences below.
QUESTION: He do not like sports.
ANSWER: He does not like sports.

EXERCISE: Find and correct mistakes
TYPE: error_correction
STYLE: cross_out
INSTRUCTIONS: Complete the sentences below.
QUESTION: They discussed about the project yesterday.
ANSWER: They discussed the project yesterday.

EXERCISE: Match answers
TYPE: matching
STYLE: tap_match
INSTRUCTIONS: Complete the sentences below.
QUESTION: cat
ANSWER: mèo
QUESTION: dog
ANSWER: chó

EXERCISE: Arrange sentence
TYPE: sentence_building
STYLE: tap_build
INSTRUCTIONS: Complete the sentences below.
QUESTION: Arrange the words into a correct sentence.
WORDS: She | is | reading | a book.

EXERCISE: Categorize
TYPE: categorization
STYLE: drag_sort
INSTRUCTIONS: Complete the sentences below.
GROUPS: Fruit | Animals
QUESTION: apple
ANSWER: Fruit
QUESTION: cat
ANSWER: Animals

EXERCISE: Inline multiple choice
TYPE: inline_selection
STYLE: pill_toggle
INSTRUCTIONS: Complete the sentences below.
QUESTION: She {{1}} a doctor.
BLANK: is => is | are

EXERCISE: Inline multiple choice
TYPE: inline_selection
STYLE: inline_select
INSTRUCTIONS: Complete the sentences below.
QUESTION: She {{1}} a doctor.
BLANK: is => is | are

EXERCISE: Inline multiple choice
TYPE: inline_selection
STYLE: fall_away
INSTRUCTIONS: Complete the sentences below.
QUESTION: She {{1}} a doctor.
BLANK: is => is | are

EXERCISE: Rewrite sentence
TYPE: short_answer
STYLE: partial_input
INSTRUCTIONS: Complete the sentences below.
QUESTION: Rewrite: He began learning English two years ago.
PREFIX: He has
ANSWER: He has learned English for two years. | He has been learning English for two years.

EXERCISE: Rewrite sentence
TYPE: short_answer
STYLE: sentence_rewrite
INSTRUCTIONS: Complete the sentences below.
QUESTION: Rewrite: He began learning English two years ago.
PREFIX: He has
ANSWER: He has learned English for two years. | He has been learning English for two years.

THEORY EXAMPLE:
THEORY: Travel phrases
CONTENT: # Asking for help
> Use **Where is ...?** to ask about a place.

Validate the whole package with Preview. Correct reported errors and preview again. Publish only the unchanged validated content. Never claim a file has been imported without a successful server response.


=== PERSONAL FLASHCARDS ONLY: GERMAN ===

WORTIFY FLASHCARD IMPORT — AI INSTRUCTIONS

Ask me for the topic, level and number of cards. Create a complete, ready-to-study deck of accurate, original German vocabulary and useful phrases, with Vietnamese meanings.

Return a valid JSON array of card objects, pretty-printed with each named field on its own line and a blank line between cards. No code fences or commentary. Maximum 2000 cards.

Use the exact field names shown below. Use empty strings for optional values. Escape quotes and newlines using valid JSON syntax.

LEARNING CONTENT REQUIREMENTS:

Generate all 5 named fields for every card. Only the term and meaning are required. Examples, their translations and part of speech are optional, but provide them when generating study material. Never omit field names.

Use natural contexts at the requested level. Avoid filler comments and duplicate example sentences.

Prepare cards for active recall and sentence production: include useful phrases/collocations, a natural example and its faithful Vietnamese translation. Learners will first recall the term from the meaning, then translate the example without seeing it, then write a different sentence. Do not require a minimum deck size for games. A study set defaults to 5 words.

FIELDS (use these exact keys):

german_text: Term or phrase — up to 500 characters.

vietnamese_meaning: Vietnamese meaning — up to 500 characters.

example_german: Example sentence in the learning language — up to 2000 characters.

example_vietnamese: Vietnamese translation of the example — up to 2000 characters.

part_of_speech: Part of speech — up to 50 characters.

Examples and translations must match. Prefer useful phrases and collocations, avoid duplicate cards, include the article in the term itself for German nouns when appropriate.

Do not add IDs, accepted_answers, accepted_examples or extra columns; these are not part of this import format.

EXAMPLE OBJECTS (place these objects inside one JSON array, separated by commas):

{
  "german_text": "eine Pause",
  "vietnamese_meaning": "nghỉ giải lao",
  "example_german": "Nach der Arbeit mache ich eine Pause.",
  "example_vietnamese": "Sau giờ làm tôi nghỉ giải lao.",
  "part_of_speech": "verb phrase"
}

{
  "german_text": "Bescheid sagen",
  "vietnamese_meaning": "báo cho biết",
  "example_german": "Kannst du mir bitte rechtzeitig Bescheid sagen?",
  "example_vietnamese": "Bạn có thể báo cho tôi kịp thời không?",
  "part_of_speech": "verb phrase"
}

{
  "german_text": "der Bahnhof",
  "vietnamese_meaning": "nhà ga",
  "example_german": "Der Bahnhof ist in der Nähe.",
  "example_vietnamese": "Nhà ga ở gần đây.",
  "part_of_speech": "noun"
}

FINAL CHECK BEFORE OUTPUT: exactly 5 named string fields per object; valid JSON; unique phrases and meanings; each example has 3–40 words and contains its target expression; accurate translations; correct grammar. Do not include this checklist in the output.

Review grammar and translations before returning. I will paste your output into Wortify, preview and confirm the import.

=== PERSONAL FLASHCARDS ONLY: ENGLISH ===

WORTIFY FLASHCARD IMPORT — AI INSTRUCTIONS

Ask me for the topic, level and number of cards. Create a complete, ready-to-study deck of accurate, original English vocabulary and useful phrases, with Vietnamese meanings.

Return a valid JSON array of card objects, pretty-printed with each named field on its own line and a blank line between cards. No code fences or commentary. Maximum 2000 cards.

Use the exact field names shown below. Use empty strings for optional values. Escape quotes and newlines using valid JSON syntax.

LEARNING CONTENT REQUIREMENTS:

Generate all 5 named fields for every card. Only the term and meaning are required. Examples, their translations and part of speech are optional, but provide them when generating study material. Never omit field names.

Use natural contexts at the requested level. Avoid filler comments and duplicate example sentences.

Prepare cards for active recall and sentence production: include useful phrases/collocations, a natural example and its faithful Vietnamese translation. Learners will first recall the term from the meaning, then translate the example without seeing it, then write a different sentence. Do not require a minimum deck size for games. A study set defaults to 5 words.

FIELDS (use these exact keys):

german_text: Term or phrase — up to 500 characters.

vietnamese_meaning: Vietnamese meaning — up to 500 characters.

example_german: Example sentence in the learning language — up to 2000 characters.

example_vietnamese: Vietnamese translation of the example — up to 2000 characters.

part_of_speech: Part of speech — up to 50 characters.

Examples and translations must match. Prefer useful phrases and collocations, avoid duplicate cards, include the article in the term itself for German nouns when appropriate.

Do not add IDs, accepted_answers, accepted_examples or extra columns; these are not part of this import format.

EXAMPLE OBJECTS (place these objects inside one JSON array, separated by commas):

{
  "german_text": "take a break",
  "vietnamese_meaning": "nghỉ giải lao",
  "example_german": "Let's take a break after this exercise.",
  "example_vietnamese": "Hãy nghỉ giải lao sau bài tập này.",
  "part_of_speech": "verb phrase"
}

{
  "german_text": "make a decision",
  "vietnamese_meaning": "đưa ra quyết định",
  "example_german": "We need to make a decision before Friday.",
  "example_vietnamese": "Chúng ta cần quyết định trước thứ Sáu.",
  "part_of_speech": "verb phrase"
}

{
  "german_text": "station",
  "vietnamese_meaning": "nhà ga",
  "example_german": "The station is near my house.",
  "example_vietnamese": "Nhà ga ở gần nhà tôi.",
  "part_of_speech": "noun"
}

FINAL CHECK BEFORE OUTPUT: exactly 5 named string fields per object; valid JSON; unique phrases and meanings; each example has 3–40 words and contains its target expression; accurate translations; correct grammar. Do not include this checklist in the output.

Review grammar and translations before returning. I will paste your output into Wortify, preview and confirm the import.

=== PRACTICE, THEORY, ALL TYPES/STYLES AND FORMATTING ===

WORTIFY · AI AUTHORING INSTRUCTIONS

Create original, accurate language-learning exercises using the exact Wortify text format below.

Learning language: German.

MY REQUEST:
Apply the user request and the execution defaults above. Do not ask again for details already specified. Use English learning content when en is requested; explanations default to Vietnamese.

Return only importable exercise text, without Markdown code fences, a preamble or a closing message. Do not copy the documentation or sample exercises into the result.

Use natural contexts, varied questions and plausible distractors. Avoid ambiguous questions. Verify every answer. Include EXPLANATION for each question and COMMENT only when a shared note is useful.

Choose only supported TYPE and STYLE values. Keep fields and syntax in English. Follow the requested language for learning content and explanations.

For sentence_building, WORDS must be in correct sentence order: the app shuffles them. For other choices, vary the position of the correct answer.

For cloze_drag_drop, explicitly choose BANK_SCOPE: question for local choices or BANK_SCOPE: exercise for shared choices. Include enough copies of repeated tokens.

Never invent uploaded media URLs. Use an existing URL supplied by me or omit the image. Attach media separately in Wortify.

Before returning, check all numbered blanks, option membership, required fields, unique matching partners and import limits. Do not claim the result has been tested in Wortify.

If I request THEORY instead: return a separate Markdown document with the supported lesson markup. Do not wrap theory in EXERCISE fields or mix it into an exercise import. I will paste it into Create > Theory.


COMPLETE EXERCISE RULES AND ALL TEMPLATES


# PRACTICE TEXT FORMAT — UTF-8 .txt
# Start each exercise with EXERCISE: title (maximum 200 characters).
# Use uppercase FIELD: value keywords. Content may be in any language.
# TYPE: one of the supported type identifiers below. STYLE: a supported style of that type.
# Put all exercise fields before the first QUESTION.
# INSTRUCTIONS: task instructions. CONTEXT: optional shared reading passage.
# GROUPS: category names separated by | (categorization only; at least two unique groups).
# CASE_SENSITIVE: yes/no. KEEP_PUNCTUATION: yes/no. Both default to no.
# QUESTION: starts a question. Each exercise needs 1–100 questions, including at least one non-example.
# ANSWER: accepted answer; separate equivalent answers with |.
# BLANK: answer 1 | equivalent answer => option 1 | option 2.
# Use {{1}}, {{2}}, etc. once each in the question, and one BLANK line per numbered blank, in order.
# WORDS: tokens separated by |. For cloze_drag_drop these form the word bank; each token can be used once.
# Repeat a token in WORDS when multiple blanks need it. If omitted, the bank uses the first answer of each blank.
# For sentence_building, WORDS must list every token in the correct answer order; duplicate words are allowed.
# PREFIX: beginning of the answer for short_answer. Every accepted answer must include that prefix.
# COMMENT: exercise-wide note before the first QUESTION, shown after a correct answer or reveal.
# EXPLANATION: optional explanation for any question or matching pair after answering correctly or revealing. EXAMPLE: yes/no after QUESTION marks a practice example.
# Blank lines and # comment lines are ignored. Use > at the start of a continuation line after QUESTION,
# INSTRUCTIONS, CONTEXT or EXPLANATION. Other fields must stay on one line.
# Do not put | or => inside an individual item. Repeat EXERCISE to import multiple exercises.
# Each field occurs once per exercise/question except BLANK, which repeats for each blank.
# Limits per import: 100 exercises, 100 questions per exercise, 2 MB total UTF-8 text.
# Save as .txt, open Create, choose or create a root folder, import files, validate, preview, then save.
# Optional attachments: add MP3, PNG, JPG, WebP or GIF in Create after validating the text.
# Up to 200 files, 200 MB total per exercise. Assign files to the whole exercise or individual questions in the Media dialog. Attachments are stored separately and are not embedded in .txt exports.
# Use preview to try each exercise before saving; preview does not save progress.
# Every exercise must belong to a folder. Loose exercises are not allowed. English and German spaces are independent.
# The whole batch is saved only after validation. Errors include line numbers.
#
# TEXT FORMATTING
# LaTeX-style lesson markup is available: line breaks, emphasis, aligned blocks, lists, tables and images.
# Open the Formatting guide in Create for supported commands and copyable examples. This is not a full TeX compiler.
# Use **bold text**, *italic text*, and [color=blue]colored text[/color].
# Available colors: red, rose, pink, magenta, purple, violet, indigo, blue, sky, cyan,
# teal, emerald, green, lime, yellow, amber, orange, coral, slate, gray.
# Formatting is supported in INSTRUCTIONS, CONTEXT, EXPLANATION and display QUESTION text.
# Keep QUESTION plain for error_correction: its words are editable answer data.
# Keep ANSWER, BLANK, WORDS, PREFIX, GROUPS and titles plain (no formatting markers).
# Formatting may wrap blanks such as {{1}}; interactive blanks also work inside tables and alignment blocks.
# Example: QUESTION: Choose the **correct verb**: She {{1}} [color=teal]every day[/color].
# Example: EXPLANATION: Use *-s* with [color=blue]he, she, it[/color].
# You can combine color with bold or italic; do not nest colors. HTML is supported only in reading CONTEXT with CONTEXT_FORMAT: html.
#
# TYPES AND STYLES
# cloze_drag_drop: drag_drop (move word tiles), tap_fill (tap words to fill blanks).
# error_correction: click_edit (edit incorrect text), cross_out (remove extra words).
#   ANSWER is the entire corrected sentence. For cross_out, only remove words; do not add or reorder them.
# matching: tap_match (match cards). Each QUESTION is one card; ANSWER is exactly one unique partner. Never reuse a partner across questions.
# sentence_building: tap_build (arrange tokens). WORDS defines the correct token order.
# categorization: drag_sort (sort cards). Each QUESTION is one card; ANSWER is exactly one GROUPS value.
# inline_selection: pill_toggle (toggle choices), inline_select (select a choice), fall_away (wrong choices disappear after a correct answer).
#   Every BLANK needs at least two options, including every accepted answer.
# BANK_SCOPE: question or exercise for cloze_drag_drop; exercise uses a shared word bank (default).
# multiple_choice: dialogue_reply or elimination; these styles require a single correct answer.
#   OPTIONS: at least two distinct choices separated by |. ANSWER must be the exact text of one choice, never its letter or index.
# true_false_not_given: evidence_judge. Use CONTEXT for the passage, OPTIONS: TRUE | FALSE | NOT_GIVEN and exactly one ANSWER: TRUE, FALSE or NOT_GIVEN. FALSE contradicts the passage; NOT_GIVEN is not established by it.
# short_answer: partial_input (complete a required PREFIX), sentence_rewrite (write the whole answer).
#   partial_input requires a nonempty PREFIX. Every accepted ANSWER must begin with that exact PREFIX.
#   ANSWER always contains the entire sentence, including PREFIX when provided.
#
# WORKSPACE AND EDITING
# Only owners can edit, rename, move or delete their content. Use the folder cards and content tools on the Create main screen for these actions.
# Drag items into folders, or use the move/group tools to organize a selection.
# Download the current .txt before editing if you want a backup. Editing questions starts a new progress revision.
# Learners answer one question at a time, retry incorrect answers and save progress rather than scores.
# Preview does not change learning progress. Workspace pins include the highest accessible parent folder.
#
# ALL SUPPORTED TYPES AND STYLES: complete importable samples follow. Lines beginning with # are documentation.

# multiple_choice / dialogue_reply
EXERCISE: Choose a response
TYPE: multiple_choice
STYLE: dialogue_reply
INSTRUCTIONS: Complete the sentences below.
QUESTION: What would you like?
OPTIONS: Tea, please. | Yesterday. | At home.
ANSWER: Tea, please.

# multiple_choice / elimination
EXERCISE: Choose a response
TYPE: multiple_choice
STYLE: elimination
INSTRUCTIONS: Complete the sentences below.
QUESTION: What would you like?
OPTIONS: Tea, please. | Yesterday. | At home.
ANSWER: Tea, please.

# true_false_not_given / evidence_judge
EXERCISE: Read and judge
TYPE: true_false_not_given
STYLE: evidence_judge
INSTRUCTIONS: Complete the sentences below.
CONTEXT: Mia lives in Berlin.
QUESTION: Mia lives in Berlin.
OPTIONS: TRUE | FALSE | NOT_GIVEN
ANSWER: TRUE

# cloze_drag_drop / drag_drop
EXERCISE: Fill in the gap
TYPE: cloze_drag_drop
STYLE: drag_drop
INSTRUCTIONS: Complete the sentences below.
QUESTION: I {{1}} coffee in the {{2}}.
BLANK: drink => drink | eat
BLANK: morning => morning | evening
WORDS: morning | drink | eat

# cloze_drag_drop / tap_fill
EXERCISE: Fill in the gap
TYPE: cloze_drag_drop
STYLE: tap_fill
INSTRUCTIONS: Complete the sentences below.
QUESTION: I {{1}} coffee in the {{2}}.
BLANK: drink => drink | eat
BLANK: morning => morning | evening
WORDS: morning | drink | eat

# error_correction / click_edit
EXERCISE: Find and correct mistakes
TYPE: error_correction
STYLE: click_edit
INSTRUCTIONS: Complete the sentences below.
QUESTION: He do not like sports.
ANSWER: He does not like sports.

# error_correction / cross_out
EXERCISE: Find and correct mistakes
TYPE: error_correction
STYLE: cross_out
INSTRUCTIONS: Complete the sentences below.
QUESTION: They discussed about the project yesterday.
ANSWER: They discussed the project yesterday.

# matching / tap_match
EXERCISE: Match answers
TYPE: matching
STYLE: tap_match
INSTRUCTIONS: Complete the sentences below.
QUESTION: cat
ANSWER: mèo
QUESTION: dog
ANSWER: chó

# sentence_building / tap_build
EXERCISE: Arrange sentence
TYPE: sentence_building
STYLE: tap_build
INSTRUCTIONS: Complete the sentences below.
QUESTION: Arrange the words into a correct sentence.
WORDS: She | is | reading | a book.

# categorization / drag_sort
EXERCISE: Categorize
TYPE: categorization
STYLE: drag_sort
INSTRUCTIONS: Complete the sentences below.
GROUPS: Fruit | Animals
QUESTION: apple
ANSWER: Fruit
QUESTION: cat
ANSWER: Animals

# inline_selection / pill_toggle
EXERCISE: Inline multiple choice
TYPE: inline_selection
STYLE: pill_toggle
INSTRUCTIONS: Complete the sentences below.
QUESTION: She {{1}} a doctor.
BLANK: is => is | are

# inline_selection / inline_select
EXERCISE: Inline multiple choice
TYPE: inline_selection
STYLE: inline_select
INSTRUCTIONS: Complete the sentences below.
QUESTION: She {{1}} a doctor.
BLANK: is => is | are

# inline_selection / fall_away
EXERCISE: Inline multiple choice
TYPE: inline_selection
STYLE: fall_away
INSTRUCTIONS: Complete the sentences below.
QUESTION: She {{1}} a doctor.
BLANK: is => is | are

# short_answer / partial_input
EXERCISE: Rewrite sentence
TYPE: short_answer
STYLE: partial_input
INSTRUCTIONS: Complete the sentences below.
QUESTION: Rewrite: He began learning English two years ago.
PREFIX: He has
ANSWER: He has learned English for two years. | He has been learning English for two years.

# short_answer / sentence_rewrite
EXERCISE: Rewrite sentence
TYPE: short_answer
STYLE: sentence_rewrite
INSTRUCTIONS: Complete the sentences below.
QUESTION: Rewrite: He began learning English two years ago.
PREFIX: He has
ANSWER: He has learned English for two years. | He has been learning English for two years.



LESSON FORMATTING REFERENCE


This is a supported LaTeX-style subset, not a TeX compiler. No custom HTML, CSS, scripts or TeX packages.

In exercise text, prefix continuation lines with >. Keep answers, choices, word banks and editable correction text plain.

Alignment: flushleft, center, flushright. Tables: l/c/r columns. Images: HTTPS or uploaded URLs; width 1–1200px or 1–100%, optional height, align=left/center/right, fit=contain/cover. Omit height to preserve proportions. Attachments are not embedded in text exports.

Dialogue / new line:
Q: {{1}} wartest du? \newline A: Auf den Bus nach Berlin.

Emphasis:
\textbf{Important} · \textit{example} · \underline{key word} · \textcolor{blue}{hint}

Alignment:
\begin{flushleft}Left aligned text and {{1}}\end{flushleft}

Table:
\begin{tabular}{lc} \textbf{Pronoun} & \textbf{Verb} \\ ich & bin \\ du & bist \end{tabular}

Image:
\includegraphics[width=320px,align=right,alt=Learning illustration]{https://example.com/image.jpg}

List:
\begin{enumerate}\item Read the sentence.\item Choose the correct word.\end{enumerate}

Heading / note:
\section{Word order}\begin{quote}The verb comes second.\end{quote}


WORKFLOW
Copy these instructions into your AI chat, add your request, then paste the result into Wortify's Text draft. Check and preview, fix reported errors, and save into a folder. Upload media separately. Review language accuracy before publishing.

=== READING ===

READING IMPORT
Start each lesson with EXERCISE: title, TYPE: reading, STYLE: split_reading. Put metadata before questions. Continue multiline fields with >. Separate lessons with EXERCISE.
1–100 lessons, 1–100 questions per lesson, maximum 2 MB UTF-8 per import. Each question needs 2–12 unique options. ANSWER uses exact option text, never letters/indexes. Do not put | inside options.
READING LESSONS
TYPE: reading. STYLE: split_reading (legacy identifier; displayed vertically: passage above questions).
CONTEXT_FORMAT: html or markdown (default markdown). CONTEXT: the complete passage, up to 100,000 characters.
Use > continuation lines for multiline HTML or lesson markup. Questions belong to this passage.
HTML is allowed only in CONTEXT. QUESTION, OPTIONS, ANSWER and EXPLANATION must contain text, never HTML. Only single-answer and multiple-answer multiple choice are supported. Each question displays its selection instruction.
For each QUESTION use OPTIONS: option 1 | option 2 | option 3 and ANSWER: exact option text.
For single-answer questions, provide exactly four options (displayed as A, B, C, D). Multiple-answer questions may have 2–12 options.
For multiple correct answers: ANSWER: option 1 | option 3. Learners must select the exact set before pressing Check.
EXPLANATION: cite the relevant passage sentence and explain the answer.
Supported HTML: h1-h4, p, div, span, strong, em, b, i, u, br, blockquote, ul, ol, li, table, thead, tbody, tr, th, td, figure, figcaption, img.
Images: <img src="https://example.org/image.jpg" alt="Description" style="width:60%;height:240px;object-fit:cover;float:right;margin:12px">.
Use text-align:left/center/right on a container to align images. Width/height accept px or %, max 1200px / 100%. Float: left/right/none; margin: 0–48px; font-size: 12–36px; color: hex only.
Scripts, forms, embedded frames, event handlers, classes, external stylesheets and arbitrary CSS are not executed. The passage uses the active theme.
Upload images with the existing Media tool and keep them attached; use their provided URL as img src. External images must be HTTPS.



EXERCISE: Practice exercise
TYPE: reading
STYLE: split_reading
INSTRUCTIONS: Complete the sentences below.
CONTEXT_FORMAT: html
CONTEXT: <h2>A greener school</h2>
> <p>Every Friday, Mia and Tom cycle to school. Their school garden grows carrots and tomatoes. On Monday, the students water the plants.</p>
QUESTION: When do Mia and Tom cycle to school?
OPTIONS: Friday | Monday | Sunday | Tuesday
ANSWER: Friday
EXPLANATION: The first sentence says every Friday.
QUESTION: Which vegetables grow in the garden? Choose all that apply.
OPTIONS: Carrots | Tomatoes | Potatoes
ANSWER: Carrots | Tomatoes
EXPLANATION: The garden grows carrots and tomatoes.


=== PRACTICE HUB JSON SCHEMA EXAMPLE ===

{
  "nodes": [
    {
      "kind": "folder",
      "title": "Practice Hub · Mười dạng nội dung",
      "children": [
        {
          "kind": "exercise",
          "title": "Điền chỗ trống",
          "payload": {
            "title": "Điền chỗ trống",
            "kind": "cloze",
            "instruction": "",
            "context": "",
            "ignore_case": true,
            "ignore_punctuation": true,
            "presentation": {
              "interaction": "cloze_drag_drop",
              "type": "cloze",
              "categories": []
            },
            "questions": [
              {
                "prompt": "She {{1}} learning.",
                "accepted_answers": [],
                "options": [],
                "blanks": [
                  {
                    "answers": [
                      "is"
                    ],
                    "options": [
                      "is",
                      "are"
                    ]
                  }
                ],
                "presentation": {
                  "word_bank": [
                    "is",
                    "are"
                  ]
                }
              }
            ]
          }
        },
        {
          "kind": "exercise",
          "title": "Tìm lỗi trong câu",
          "payload": {
            "title": "Tìm lỗi trong câu",
            "kind": "multi",
            "instruction": "",
            "context": "",
            "ignore_case": true,
            "ignore_punctuation": true,
            "presentation": {
              "interaction": "inline_error_identification",
              "type": "multi",
              "categories": []
            },
            "questions": [
              {
                "prompt": "{{a}} {{b}} {{c}}",
                "accepted_answers": [
                  "b"
                ],
                "options": [
                  "a",
                  "b",
                  "c"
                ],
                "blanks": [],
                "presentation": {
                  "tokens": [
                    {
                      "id": "a",
                      "text": "She"
                    },
                    {
                      "id": "b",
                      "text": "go"
                    },
                    {
                      "id": "c",
                      "text": "home."
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          "kind": "exercise",
          "title": "Viết câu ngắn",
          "payload": {
            "title": "Viết câu ngắn",
            "kind": "text",
            "instruction": "",
            "context": "",
            "ignore_case": true,
            "ignore_punctuation": true,
            "presentation": {
              "interaction": "short_answer",
              "type": "text",
              "categories": []
            },
            "questions": [
              {
                "prompt": "Translate: xin chào",
                "accepted_answers": [
                  "hello"
                ],
                "options": [],
                "blanks": [],
                "presentation": {}
              }
            ]
          }
        },
        {
          "kind": "exercise",
          "title": "Sắp xếp câu",
          "payload": {
            "title": "Sắp xếp câu",
            "kind": "order",
            "instruction": "",
            "context": "",
            "ignore_case": true,
            "ignore_punctuation": true,
            "presentation": {
              "interaction": "sentence_building",
              "type": "order",
              "categories": []
            },
            "questions": [
              {
                "prompt": "Build the sentence.",
                "accepted_answers": [
                  "a",
                  "b",
                  "c"
                ],
                "options": [],
                "blanks": [],
                "presentation": {
                  "tokens": [
                    {
                      "id": "a",
                      "text": "She"
                    },
                    {
                      "id": "b",
                      "text": "goes"
                    },
                    {
                      "id": "c",
                      "text": "home."
                    }
                  ]
                }
              }
            ]
          }
        },
        {
          "kind": "exercise",
          "title": "Trắc nghiệm",
          "payload": {
            "title": "Trắc nghiệm",
            "kind": "choice",
            "instruction": "",
            "context": "",
            "ignore_case": true,
            "ignore_punctuation": true,
            "presentation": {
              "interaction": "multiple_choice",
              "type": "choice",
              "categories": []
            },
            "questions": [
              {
                "prompt": "Choose a greeting.",
                "accepted_answers": [
                  "hello"
                ],
                "options": [
                  "hello",
                  "book",
                  "red",
                  "run"
                ],
                "blanks": [],
                "presentation": {}
              }
            ]
          }
        },
        {
          "kind": "exercise",
          "title": "Phân loại",
          "payload": {
            "title": "Phân loại",
            "kind": "choice",
            "instruction": "",
            "context": "",
            "ignore_case": true,
            "ignore_punctuation": true,
            "presentation": {
              "interaction": "categorization",
              "type": "choice",
              "categories": [
                "Greetings",
                "Objects"
              ]
            },
            "questions": [
              {
                "prompt": "hello",
                "accepted_answers": [
                  "Greetings"
                ],
                "options": [
                  "Greetings",
                  "Objects"
                ],
                "blanks": [],
                "presentation": {}
              }
            ]
          }
        },
        {
          "kind": "exercise",
          "title": "Nghe – chép",
          "payload": {
            "title": "Nghe – chép",
            "kind": "text",
            "instruction": "",
            "context": "",
            "ignore_case": true,
            "ignore_punctuation": true,
            "presentation": {
              "interaction": "audio_dictation",
              "type": "text",
              "categories": []
            },
            "questions": [
              {
                "prompt": "Type the sound you hear in English.",
                "accepted_answers": [
                  "beep"
                ],
                "options": [],
                "blanks": [],
                "presentation": {
                  "audio": "/audio/tone.wav"
                }
              }
            ]
          }
        },
        {
          "kind": "exercise",
          "title": "Nối cặp",
          "payload": {
            "title": "Nối cặp",
            "kind": "matching",
            "instruction": "",
            "context": "",
            "ignore_case": true,
            "ignore_punctuation": true,
            "presentation": {
              "interaction": "matching",
              "type": "matching",
              "categories": []
            },
            "questions": [
              {
                "prompt": "xin chào",
                "accepted_answers": [
                  "hello"
                ],
                "options": [
                  "hello"
                ],
                "blanks": [],
                "presentation": {}
              }
            ]
          }
        },
        {
          "kind": "exercise",
          "title": "Đúng / Sai / Không có",
          "payload": {
            "title": "Đúng / Sai / Không có",
            "kind": "choice",
            "instruction": "",
            "context": "Anna reads a book every day.",
            "ignore_case": true,
            "ignore_punctuation": true,
            "presentation": {
              "interaction": "true_false_not_given",
              "type": "choice",
              "categories": []
            },
            "questions": [
              {
                "prompt": "Anna reads daily.",
                "accepted_answers": [
                  "TRUE"
                ],
                "options": [
                  "TRUE",
                  "FALSE",
                  "NOT_GIVEN"
                ],
                "blanks": [],
                "presentation": {}
              }
            ]
          }
        },
        {
          "kind": "theory",
          "title": "Lý thuyết mẫu",
          "payload": {
            "format": "markdown",
            "content": "# Chào hỏi\n\n**Hello** nghĩa là xin chào."
          }
        }
      ]
    }
  ]
}

=== LEGACY JSON SYSTEM CONTENT EXAMPLE (OPTIONAL) ===

{
  "format": "wortify-content",
  "version": 1,
  "id": "5a5ab11d-0ab8-4745-bef1-236b52a2bac1",
  "title": "A2 · Giao thông",
  "language": "de",
  "practice": [
    {
      "kind": "folder",
      "title": "Bài tập giao thông",
      "children": [
        {
          "kind": "exercise",
          "title": "Choose a response",
          "payload": {
            "title": "Choose a response",
            "instruction": "Complete the sentences below.",
            "kind": "choice",
            "presentation": {
              "interaction": "multiple_choice",
              "style": "dialogue_reply"
            },
            "questions": [
              {
                "prompt": "What would you like?",
                "accepted_answers": [
                  "Tea, please."
                ],
                "options": [
                  "Tea, please.",
                  "Yesterday.",
                  "At home."
                ],
                "blanks": [],
                "presentation": {},
                "id": "1",
                "position": 1,
                "kind": "choice"
              }
            ],
            "ignore_case": true,
            "ignore_punctuation": true,
            "check_mode": "auto_check"
          }
        },
        {
          "kind": "theory",
          "title": "Ghi chú",
          "payload": {
            "format": "markdown",
            "content": "mit + Dativ"
          }
        }
      ]
    }
  ],
  "reading": [
    {
      "kind": "folder",
      "title": "Bài đọc",
      "children": [
        {
          "kind": "reading",
          "title": "Practice exercise",
          "payload": {
            "title": "Practice exercise",
            "instruction": "Complete the sentences below.",
            "kind": "choice",
            "presentation": {
              "interaction": "reading",
              "style": "split_reading",
              "context_format": "html"
            },
            "questions": [
              {
                "prompt": "When do Mia and Tom cycle to school?",
                "accepted_answers": [
                  "Friday"
                ],
                "options": [
                  "Friday",
                  "Monday",
                  "Sunday",
                  "Tuesday"
                ],
                "blanks": [],
                "presentation": {
                  "explanation": "The first sentence says every Friday."
                },
                "id": "1",
                "position": 1,
                "kind": "choice"
              },
              {
                "prompt": "Which vegetables grow in the garden? Choose all that apply.",
                "accepted_answers": [
                  "Carrots",
                  "Tomatoes"
                ],
                "options": [
                  "Carrots",
                  "Tomatoes",
                  "Potatoes"
                ],
                "blanks": [],
                "presentation": {
                  "explanation": "The garden grows carrots and tomatoes."
                },
                "id": "2",
                "position": 2,
                "kind": "multi"
              }
            ],
            "ignore_case": true,
            "ignore_punctuation": true,
            "context": "<h2>A greener school</h2>\n<p>Every Friday, Mia and Tom cycle to school. Their school garden grows carrots and tomatoes. On Monday, the students water the plants.</p>",
            "check_mode": "auto_check"
          }
        }
      ]
    }
  ]
}


=== VERIFICATION ===

Validate each generated batch using the current application parser/preview and backend. Check answer correctness separately. Save only after validation. Confirm counts by reading saved content. Report offline files separately from saved content. Do not paste this guide into the app import box.
``````
