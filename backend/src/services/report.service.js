const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  navy: [0.055, 0.102, 0.22],
  purple: [0.36, 0.24, 0.82],
  purpleLight: [0.94, 0.92, 1],
  blueLight: [0.91, 0.96, 1],
  green: [0.04, 0.56, 0.38],
  greenLight: [0.9, 0.98, 0.95],
  orange: [0.88, 0.45, 0.08],
  orangeLight: [1, 0.96, 0.89],
  red: [0.78, 0.12, 0.16],
  redLight: [1, 0.93, 0.94],
  ink: [0.09, 0.12, 0.2],
  muted: [0.39, 0.43, 0.52],
  border: [0.85, 0.87, 0.91],
  surface: [0.97, 0.98, 0.99],
  white: [1, 1, 1]
};

const safeText = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E]/g, '?');

const escapePdfText = (value) =>
  safeText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const formatNumber = (value, digits = 1) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return Number.isInteger(numeric)
    ? String(numeric)
    : numeric.toFixed(digits).replace(/\.0+$/, '');
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDuration = (seconds = 0) => {
  const total = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = Math.round(total % 60);

  if (hours > 0) return `${hours}h ${minutes}m ${remaining}s`;
  return `${minutes}m ${remaining}s`;
};

const humanizeStatus = (value) => {
  const text = String(value || 'Not available').replace(/_/g, ' ').trim();
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const rgb = (color) => color.map((value) => Number(value).toFixed(3)).join(' ');

const wrapText = (value, maxChars = 80) => {
  const text = safeText(value).trim();
  if (!text) return [''];

  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

class PdfDocumentBuilder {
  constructor() {
    this.pages = [[]];
    this.currentY = PAGE_HEIGHT - MARGIN;
  }

  get currentPage() {
    return this.pages[this.pages.length - 1];
  }

  newPage() {
    this.pages.push([]);
    this.currentY = PAGE_HEIGHT - MARGIN;
  }

  ensureSpace(height = 20) {
    if (this.currentY - height < MARGIN + 22) {
      this.newPage();
    }
  }

  add(command) {
    this.currentPage.push(command);
  }

  rect(x, y, width, height, options = {}) {
    this.add({
      type: 'rect',
      x,
      y,
      width,
      height,
      fill: options.fill || null,
      stroke: options.stroke || null,
      lineWidth: options.lineWidth || 0.8
    });
  }

  line(x1, y1, x2, y2, options = {}) {
    this.add({
      type: 'line',
      x1,
      y1,
      x2,
      y2,
      color: options.color || COLORS.border,
      lineWidth: options.lineWidth || 0.8
    });
  }

  textAt(value, x, y, options = {}) {
    const {
      size = 10,
      bold = false,
      color = COLORS.ink,
      maxChars = 80,
      lineHeight = size + 3,
      align = 'left',
      width = null
    } = options;

    const lines = wrapText(value, maxChars);

    lines.forEach((line, index) => {
      let textX = x;
      if (width && align !== 'left') {
        const approximateWidth = safeText(line).length * size * 0.5;
        if (align === 'center') textX = x + Math.max(0, (width - approximateWidth) / 2);
        if (align === 'right') textX = x + Math.max(0, width - approximateWidth);
      }

      this.add({
        type: 'text',
        text: line,
        x: textX,
        y: y - index * lineHeight,
        size,
        bold,
        color
      });
    });

    return lines.length * lineHeight;
  }

  text(value, options = {}) {
    const {
      size = 10,
      bold = false,
      x = MARGIN,
      width = CONTENT_WIDTH,
      lineHeight = size + 3,
      maxChars = 84,
      gapAfter = 0,
      color = COLORS.ink,
      align = 'left'
    } = options;

    const lines = wrapText(value, maxChars);
    const required = lines.length * lineHeight + gapAfter;
    this.ensureSpace(required);

    lines.forEach((line) => {
      this.textAt(line, x, this.currentY, {
        size,
        bold,
        color,
        align,
        width,
        maxChars: Math.max(maxChars, line.length)
      });
      this.currentY -= lineHeight;
    });

    this.currentY -= gapAfter;
  }

  spacer(height = 10) {
    this.currentY -= height;
  }

  sectionTitle(title) {
    this.ensureSpace(34);
    this.currentY -= 3;
    this.rect(MARGIN, this.currentY - 22, CONTENT_WIDTH, 26, {
      fill: COLORS.surface,
      stroke: COLORS.border
    });
    this.rect(MARGIN, this.currentY - 22, 5, 26, { fill: COLORS.purple });
    this.textAt(title, MARGIN + 14, this.currentY - 5, {
      size: 11,
      bold: true,
      color: COLORS.navy
    });
    this.currentY -= 34;
  }

  infoGrid(items, options = {}) {
    const columns = options.columns || 2;
    const gap = options.gap || 12;
    const boxHeight = options.boxHeight || 44;
    const boxWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;

    for (let index = 0; index < items.length; index += columns) {
      this.ensureSpace(boxHeight + 10);
      const rowY = this.currentY - boxHeight;

      for (let column = 0; column < columns; column += 1) {
        const item = items[index + column];
        if (!item) continue;
        const x = MARGIN + column * (boxWidth + gap);

        this.rect(x, rowY, boxWidth, boxHeight, {
          fill: item.fill || COLORS.surface,
          stroke: COLORS.border
        });
        this.textAt(item.label, x + 10, rowY + boxHeight - 14, {
          size: 7.5,
          bold: true,
          color: COLORS.muted,
          maxChars: 28
        });
        this.textAt(item.value, x + 10, rowY + boxHeight - 29, {
          size: item.valueSize || 10,
          bold: item.bold !== false,
          color: item.color || COLORS.ink,
          maxChars: 34
        });
      }

      this.currentY = rowY - 10;
    }
  }

  metricCards(cards) {
    const gap = 10;
    const width = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
    const height = 66;
    this.ensureSpace(height + 12);
    const y = this.currentY - height;

    cards.forEach((card, index) => {
      const x = MARGIN + index * (width + gap);
      this.rect(x, y, width, height, {
        fill: card.fill || COLORS.purpleLight,
        stroke: card.stroke || COLORS.border
      });
      this.textAt(card.label, x + 10, y + height - 16, {
        size: 7.5,
        bold: true,
        color: COLORS.muted,
        maxChars: 24
      });
      this.textAt(card.value, x + 10, y + height - 39, {
        size: card.valueSize || 18,
        bold: true,
        color: card.color || COLORS.navy,
        maxChars: 18
      });
      if (card.note) {
        this.textAt(card.note, x + 10, y + 11, {
          size: 7,
          color: COLORS.muted,
          maxChars: 28
        });
      }
    });

    this.currentY = y - 12;
  }

  paragraphBox(title, text, options = {}) {
    const maxChars = options.maxChars || 78;
    const lines = wrapText(text || 'Not provided.', maxChars);
    const height = 28 + lines.length * 12 + 10;
    this.ensureSpace(height + 8);
    const y = this.currentY - height;

    this.rect(MARGIN, y, CONTENT_WIDTH, height, {
      fill: options.fill || COLORS.surface,
      stroke: options.stroke || COLORS.border
    });
    this.textAt(title, MARGIN + 12, y + height - 17, {
      size: 9,
      bold: true,
      color: options.titleColor || COLORS.navy
    });

    lines.forEach((line, index) => {
      this.textAt(line, MARGIN + 12, y + height - 34 - index * 12, {
        size: 8.5,
        color: COLORS.ink,
        maxChars
      });
    });

    this.currentY = y - 8;
  }

  questionCard({ index, question, type, answer, score, maxScore, feedback, missingConcepts }) {
    const questionLines = wrapText(question || 'Question', 76);
    const answerLines = wrapText(answer || 'No answer submitted.', 82);
    const feedbackLines = feedback ? wrapText(feedback, 82) : [];
    const missingLines = missingConcepts?.length
      ? wrapText(`Missing concepts: ${missingConcepts.join(', ')}`, 82)
      : [];

    const height =
      82 +
      questionLines.length * 12 +
      answerLines.length * 11 +
      (feedbackLines.length ? 20 + feedbackLines.length * 11 : 0) +
      (missingLines.length ? 8 + missingLines.length * 11 : 0);

    this.ensureSpace(Math.min(height, PAGE_HEIGHT - MARGIN * 2));
    const y = this.currentY - height;

    this.rect(MARGIN, y, CONTENT_WIDTH, height, {
      fill: COLORS.white,
      stroke: COLORS.border
    });
    this.rect(MARGIN, y + height - 30, CONTENT_WIDTH, 30, {
      fill: COLORS.surface
    });

    this.textAt(`Question ${index}`, MARGIN + 12, y + height - 19, {
      size: 9,
      bold: true,
      color: COLORS.purple
    });
    this.textAt(`${formatNumber(score)} / ${formatNumber(maxScore)}`, PAGE_WIDTH - MARGIN - 78, y + height - 19, {
      size: 10,
      bold: true,
      color: Number(score) >= Number(maxScore) ? COLORS.green : COLORS.navy,
      align: 'right',
      width: 66
    });

    let cursorY = y + height - 45;
    questionLines.forEach((line) => {
      this.textAt(line, MARGIN + 12, cursorY, {
        size: 10,
        bold: true,
        color: COLORS.ink,
        maxChars: 76
      });
      cursorY -= 12;
    });

    this.textAt(`Type: ${type}`, MARGIN + 12, cursorY - 2, {
      size: 7.5,
      color: COLORS.muted
    });
    cursorY -= 19;

    this.textAt('Student answer', MARGIN + 12, cursorY, {
      size: 8,
      bold: true,
      color: COLORS.muted
    });
    cursorY -= 13;
    answerLines.forEach((line) => {
      this.textAt(line, MARGIN + 12, cursorY, {
        size: 8.5,
        color: COLORS.ink,
        maxChars: 82
      });
      cursorY -= 11;
    });

    if (feedbackLines.length) {
      cursorY -= 4;
      this.textAt('Feedback', MARGIN + 12, cursorY, {
        size: 8,
        bold: true,
        color: COLORS.purple
      });
      cursorY -= 13;
      feedbackLines.forEach((line) => {
        this.textAt(line, MARGIN + 12, cursorY, {
          size: 8.5,
          color: COLORS.ink,
          maxChars: 82
        });
        cursorY -= 11;
      });
    }

    missingLines.forEach((line) => {
      this.textAt(line, MARGIN + 12, cursorY - 2, {
        size: 8,
        color: COLORS.red,
        maxChars: 82
      });
      cursorY -= 11;
    });

    this.currentY = y - 10;
  }

  tableHeader(columns) {
    const height = 26;
    this.ensureSpace(height + 5);
    const y = this.currentY - height;
    this.rect(MARGIN, y, CONTENT_WIDTH, height, { fill: COLORS.navy });

    let x = MARGIN;
    columns.forEach((column) => {
      this.textAt(column.label, x + 6, y + 9, {
        size: 7,
        bold: true,
        color: COLORS.white,
        maxChars: column.maxChars || 18
      });
      x += column.width;
    });

    this.currentY = y;
  }

  tableRow(values, columns, index) {
    const lineCounts = values.map((value, valueIndex) =>
      wrapText(value, columns[valueIndex].maxChars || 18).length
    );
    const height = Math.max(28, 12 + Math.max(...lineCounts) * 10);
    this.ensureSpace(height + 4);
    const y = this.currentY - height;

    this.rect(MARGIN, y, CONTENT_WIDTH, height, {
      fill: index % 2 === 0 ? COLORS.white : COLORS.surface,
      stroke: COLORS.border,
      lineWidth: 0.5
    });

    let x = MARGIN;
    values.forEach((value, valueIndex) => {
      const column = columns[valueIndex];
      const lines = wrapText(value, column.maxChars || 18);
      lines.forEach((line, lineIndex) => {
        this.textAt(line, x + 6, y + height - 14 - lineIndex * 10, {
          size: 7.2,
          bold: column.bold || false,
          color: column.color || COLORS.ink,
          maxChars: column.maxChars || 18
        });
      });
      x += column.width;
    });

    this.currentY = y;
  }

  addHeader(title, subtitle) {
    const top = PAGE_HEIGHT;
    this.rect(0, top - 106, PAGE_WIDTH, 106, { fill: COLORS.navy });
    this.rect(0, top - 106, PAGE_WIDTH, 5, { fill: COLORS.purple });
    this.textAt('LearnExa', MARGIN, top - 40, {
      size: 24,
      bold: true,
      color: COLORS.white
    });
    this.textAt(title, MARGIN, top - 67, {
      size: 14,
      bold: true,
      color: COLORS.white,
      maxChars: 58
    });
    this.textAt(subtitle, MARGIN, top - 87, {
      size: 8,
      color: [0.82, 0.85, 0.94],
      maxChars: 76
    });
    this.currentY = top - 128;
  }

  build() {
    const objects = [];
    const addObject = (content) => {
      objects.push(Buffer.from(content, 'binary'));
      return objects.length;
    };

    const catalogId = addObject('');
    const pagesId = addObject('');
    const regularFontId = addObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    );
    const boldFontId = addObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
    );

    const pageIds = [];

    this.pages.forEach((pageCommands, pageIndex) => {
      const streamParts = [];

      pageCommands.forEach((command) => {
        if (command.type === 'rect') {
          const parts = [];
          if (command.fill) parts.push(`${rgb(command.fill)} rg`);
          if (command.stroke) parts.push(`${rgb(command.stroke)} RG`);
          parts.push(`${command.lineWidth} w`);
          parts.push(`${command.x} ${command.y} ${command.width} ${command.height} re`);
          parts.push(command.fill && command.stroke ? 'B' : command.fill ? 'f' : 'S');
          streamParts.push(parts.join(' '));
          return;
        }

        if (command.type === 'line') {
          streamParts.push(
            `${rgb(command.color)} RG ${command.lineWidth} w ${command.x1} ${command.y1} m ${command.x2} ${command.y2} l S`
          );
          return;
        }

        streamParts.push(
          `${rgb(command.color || COLORS.ink)} rg BT /${command.bold ? 'F2' : 'F1'} ${command.size} Tf 1 0 0 1 ${command.x} ${command.y} Tm (${escapePdfText(command.text)}) Tj ET`
        );
      });

      streamParts.push(
        `${rgb(COLORS.border)} RG 0.6 w ${MARGIN} 28 m ${PAGE_WIDTH - MARGIN} 28 l S`
      );
      streamParts.push(
        `${rgb(COLORS.muted)} rg BT /F1 7 Tf 1 0 0 1 ${MARGIN} 16 Tm (LearnExa - Assessment intelligence platform) Tj ET`
      );
      streamParts.push(
        `${rgb(COLORS.muted)} rg BT /F1 7 Tf 1 0 0 1 ${PAGE_WIDTH - MARGIN - 48} 16 Tm (Page ${pageIndex + 1} of ${this.pages.length}) Tj ET`
      );

      const stream = streamParts.join('\n');
      const contentId = addObject(
        `<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}\nendstream`
      );
      const pageId = addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
    });

    objects[catalogId - 1] = Buffer.from(
      `<< /Type /Catalog /Pages ${pagesId} 0 R >>`,
      'binary'
    );
    objects[pagesId - 1] = Buffer.from(
      `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds
        .map((id) => `${id} 0 R`)
        .join(' ')}] >>`,
      'binary'
    );

    const chunks = [Buffer.from('%PDF-1.4\n%LearnExa\n', 'binary')];
    const offsets = [0];
    let offset = chunks[0].length;

    objects.forEach((object, index) => {
      offsets[index + 1] = offset;
      const prefix = Buffer.from(`${index + 1} 0 obj\n`, 'binary');
      const suffix = Buffer.from('\nendobj\n', 'binary');
      chunks.push(prefix, object, suffix);
      offset += prefix.length + object.length + suffix.length;
    });

    const xrefOffset = offset;
    const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f '];

    for (let index = 1; index <= objects.length; index += 1) {
      xrefLines.push(`${String(offsets[index]).padStart(10, '0')} 00000 n `);
    }

    const trailer = [
      ...xrefLines,
      'trailer',
      `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>`,
      'startxref',
      String(xrefOffset),
      '%%EOF'
    ].join('\n');

    chunks.push(Buffer.from(trailer, 'binary'));
    return Buffer.concat(chunks);
  }
}

const getPerformanceLabel = (percentage) => {
  const score = Number(percentage) || 0;
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Very Good';
  if (score >= 60) return 'Good';
  if (score >= 50) return 'Pass';
  return 'Needs Improvement';
};

const getPerformanceColor = (percentage) => {
  const score = Number(percentage) || 0;
  if (score >= 70) return COLORS.green;
  if (score >= 50) return COLORS.orange;
  return COLORS.red;
};

const buildSubmissionReportPdf = (submission) => {
  const doc = new PdfDocumentBuilder();
  const quiz = submission.quiz || {};
  const student = submission.student || {};
  const score = Number(submission.totalScore) || 0;
  const maxScore = Number(submission.maxScore ?? quiz.totalMarks) || 0;
  const percentage = Number(submission.percentage) || 0;

  doc.addHeader(
    'Student Assessment Report',
    `Generated ${formatDate(new Date())} | Official LearnExa result summary`
  );

  doc.metricCards([
    {
      label: 'MARKS OBTAINED',
      value: `${formatNumber(score)} / ${formatNumber(maxScore)}`,
      fill: COLORS.purpleLight,
      color: COLORS.purple,
      valueSize: 16
    },
    {
      label: 'PERCENTAGE',
      value: `${formatNumber(percentage)}%`,
      fill: percentage >= 50 ? COLORS.greenLight : COLORS.redLight,
      color: getPerformanceColor(percentage)
    },
    {
      label: 'PERFORMANCE',
      value: getPerformanceLabel(percentage),
      fill: COLORS.blueLight,
      color: COLORS.navy,
      valueSize: 13
    }
  ]);

  doc.sectionTitle('Student and assessment details');
  doc.infoGrid([
    { label: 'STUDENT NAME', value: student.name || 'Student' },
    { label: 'ROLL NUMBER', value: student.rollNo || 'N/A' },
    { label: 'EMAIL', value: student.email || 'N/A', valueSize: 8.5 },
    { label: 'ASSESSMENT', value: quiz.title || 'Untitled Quiz', valueSize: 9 },
    {
      label: 'SUBJECT / TOPIC',
      value: quiz.subject?.name || quiz.category || 'N/A',
      valueSize: 9
    },
    { label: 'SUBMITTED', value: formatDate(submission.submittedAt), valueSize: 8.3 },
    { label: 'TIME USED', value: formatDuration(submission.timeTaken) },
    { label: 'EVALUATION STATUS', value: humanizeStatus(submission.overallStatus), valueSize: 9 }
  ]);

  doc.sectionTitle('Academic feedback');
  doc.paragraphBox(
    'Teacher feedback',
    submission.teacherFeedback || 'No overall teacher feedback was provided.',
    { fill: COLORS.purpleLight, titleColor: COLORS.purple }
  );
  if (submission.aiFeedbackSummary) {
    doc.paragraphBox('Evaluation summary', submission.aiFeedbackSummary, {
      fill: COLORS.blueLight,
      titleColor: COLORS.navy
    });
  }

  doc.sectionTitle('Integrity and proctoring summary');
  doc.infoGrid(
    [
      { label: 'TAB SWITCHES', value: formatNumber(submission.tabSwitchCount || 0) },
      { label: 'FOCUS LOSSES', value: formatNumber(submission.focusLossCount || 0) },
      { label: 'COPY ATTEMPTS', value: formatNumber(submission.copyAttemptCount || 0) },
      { label: 'QUIZ LOCKS', value: formatNumber(submission.lockCount || 0) },
      { label: 'WARNINGS', value: formatNumber(submission.warnings || 0) },
      {
        label: 'SUBMISSION TIMING',
        value: submission.isExpired ? 'Submitted after time limit' : 'Within allowed time',
        color: submission.isExpired ? COLORS.red : COLORS.green,
        valueSize: 8.5
      }
    ],
    { columns: 3, boxHeight: 46 }
  );

  if (Array.isArray(submission.suspiciousFlags) && submission.suspiciousFlags.length) {
    doc.paragraphBox('Recorded integrity events', submission.suspiciousFlags.join(' | '), {
      fill: COLORS.redLight,
      titleColor: COLORS.red
    });
  }

  doc.sectionTitle('Question-by-question review');

  const questionById = new Map(
    (quiz.questions || []).map((question) => [question._id.toString(), question])
  );

  (submission.answers || []).forEach((answer, index) => {
    const question =
      questionById.get(answer.question?.toString()) || answer.question || {};

    doc.questionCard({
      index: index + 1,
      question: question.text || 'Question',
      type: answer.questionType === 'short' ? 'Short answer' : 'Multiple choice',
      answer: answer.answer || 'No answer submitted.',
      score: answer.finalScore ?? 0,
      maxScore: answer.maxMarks ?? question.marks ?? 0,
      feedback: answer.teacherComment || answer.aiFeedback || '',
      missingConcepts: Array.isArray(answer.aiMissingConcepts)
        ? answer.aiMissingConcepts
        : []
    });
  });

  doc.paragraphBox(
    'Report note',
    'This report reflects the latest marks and feedback stored in LearnExa at the time of download.',
    { fill: COLORS.surface, titleColor: COLORS.muted }
  );

  return doc.build();
};

const buildTeacherReportPdf = ({ teacherName, submissions }) => {
  const doc = new PdfDocumentBuilder();
  const safeSubmissions = Array.isArray(submissions) ? submissions : [];
  const graded = safeSubmissions.filter(
    (submission) => submission.overallStatus === 'fully_graded'
  );

  const percentages = graded.map((submission) => Number(submission.percentage) || 0);
  const average = percentages.length
    ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length
    : 0;
  const highest = percentages.length ? Math.max(...percentages) : 0;
  const passed = percentages.filter((value) => value >= 50).length;
  const passRate = percentages.length ? (passed / percentages.length) * 100 : 0;

  doc.addHeader(
    'Teacher Assessment Performance Report',
    `Prepared for ${teacherName || 'Teacher'} | Generated ${formatDate(new Date())}`
  );

  doc.metricCards([
    {
      label: 'TOTAL SUBMISSIONS',
      value: formatNumber(safeSubmissions.length),
      fill: COLORS.purpleLight,
      color: COLORS.purple
    },
    {
      label: 'FULLY GRADED',
      value: formatNumber(graded.length),
      fill: COLORS.blueLight,
      color: COLORS.navy
    },
    {
      label: 'AVERAGE SCORE',
      value: `${formatNumber(average)}%`,
      fill: COLORS.greenLight,
      color: COLORS.green
    },
    {
      label: 'PASS RATE',
      value: `${formatNumber(passRate)}%`,
      fill: passRate >= 50 ? COLORS.greenLight : COLORS.orangeLight,
      color: passRate >= 50 ? COLORS.green : COLORS.orange
    }
  ]);

  doc.sectionTitle('Report overview');
  doc.infoGrid([
    { label: 'TEACHER', value: teacherName || 'Teacher' },
    { label: 'HIGHEST SCORE', value: `${formatNumber(highest)}%` },
    {
      label: 'PENDING / IN REVIEW',
      value: formatNumber(safeSubmissions.length - graded.length)
    },
    { label: 'REPORT GENERATED', value: formatDate(new Date()), valueSize: 8.5 }
  ]);

  const quizGroups = new Map();
  safeSubmissions.forEach((submission) => {
    const title = submission.quiz?.title || 'Deleted Quiz';
    if (!quizGroups.has(title)) quizGroups.set(title, []);
    quizGroups.get(title).push(submission);
  });

  doc.sectionTitle('Quiz-wise performance');

  if (quizGroups.size === 0) {
    doc.paragraphBox('No data available', 'No student submissions were found for this teacher.');
  } else {
    quizGroups.forEach((items, title) => {
      const completed = items.filter(
        (submission) => submission.overallStatus === 'fully_graded'
      );
      const quizAverage = completed.length
        ? completed.reduce(
            (sum, submission) => sum + (Number(submission.percentage) || 0),
            0
          ) / completed.length
        : 0;

      doc.paragraphBox(
        title,
        `${items.length} submission(s) | ${completed.length} fully graded | Average ${formatNumber(
          quizAverage
        )}%`,
        { fill: COLORS.blueLight, titleColor: COLORS.navy }
      );
    });
  }

  doc.sectionTitle('Detailed submission register');

  const columns = [
    { label: '#', width: 24, maxChars: 3 },
    { label: 'STUDENT', width: 98, maxChars: 20, bold: true },
    { label: 'ROLL NO.', width: 66, maxChars: 13 },
    { label: 'ASSESSMENT', width: 116, maxChars: 24 },
    { label: 'SCORE', width: 60, maxChars: 12 },
    { label: 'PERCENT', width: 54, maxChars: 10 },
    { label: 'STATUS', width: 93, maxChars: 18 }
  ];

  doc.tableHeader(columns);

  safeSubmissions.forEach((submission, index) => {
    if (doc.currentY < MARGIN + 70) {
      doc.newPage();
      doc.sectionTitle('Detailed submission register - continued');
      doc.tableHeader(columns);
    }

    doc.tableRow(
      [
        String(index + 1),
        submission.student?.name || 'Unknown Student',
        submission.student?.rollNo || 'N/A',
        submission.quiz?.title || 'Deleted Quiz',
        `${formatNumber(submission.totalScore ?? 0)} / ${formatNumber(
          submission.maxScore ?? submission.quiz?.totalMarks ?? 0
        )}`,
        `${formatNumber(submission.percentage ?? 0)}%`,
        humanizeStatus(submission.overallStatus)
      ],
      columns,
      index
    );
  });

  doc.currentY -= 12;
  doc.paragraphBox(
    'Teacher note',
    'This report includes the latest submission and grading records available in LearnExa. Download a student-specific report for full question-level feedback.',
    { fill: COLORS.surface, titleColor: COLORS.muted }
  );

  return doc.build();
};

module.exports = {
  buildSubmissionReportPdf,
  buildTeacherReportPdf
};
