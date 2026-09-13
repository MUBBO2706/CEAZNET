export const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '';

    // 1. Protect Code Blocks: Extract them so we don't mess up their newlines
    const codeBlocks: string[] = [];
    let processed = markdown.replace(/```([\s\S]*?)```/gim, (match, code) => {
        codeBlocks.push(code); // Keep original code content
        return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
    });

    // --- Table Processing Helper Functions ---
    const isSeparatorRow = (rowCells: string[]): boolean => {
        if (rowCells.length === 0) return false;
        return rowCells.every(cell => {
            const clean = cell.trim();
            if (clean === '') return true;
            return /^[:-]+$/.test(clean);
        });
    };

    const renderTable = (rows: string[][]): string => {
        if (rows.length < 2) {
            return rows.map(r => '| ' + r.join(' | ') + ' |').join('\n');
        }

        const hasSeparator = isSeparatorRow(rows[1]);
        let tableHtml = '<table class="w-full border-collapse my-4 table-auto">';
        
        const headers = rows[0];
        tableHtml += '<thead><tr>';
        headers.forEach(cell => {
            const content = cell
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/\*(.*?)\*/g, '<i>$1</i>');
            tableHtml += `<th class="border px-4 py-2 bg-neutral-100 dark:bg-neutral-800 font-bold border-neutral-300 dark:border-neutral-700 text-left">${content}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        const startIndex = hasSeparator ? 2 : 1;
        for (let i = startIndex; i < rows.length; i++) {
            const cells = rows[i];
            tableHtml += '<tr>';
            const colCount = headers.length;
            for (let j = 0; j < colCount; j++) {
                const cell = cells[j] || '';
                const content = cell
                    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                    .replace(/\*(.*?)\*/g, '<i>$1</i>');
                tableHtml += `<td class="border px-4 py-2 border-neutral-300 dark:border-neutral-700">${content}</td>`;
            }
            tableHtml += '</tr>';
        }

        tableHtml += '</tbody></table>';
        return tableHtml;
    };

    const parseMarkdownTables = (text: string): string => {
        const lines = text.replace(/\r/g, '').split('\n');
        const resultLines: string[] = [];
        let inTable = false;
        let tableRows: string[][] = [];

        const isTableRow = (line: string): boolean => {
            const trimmed = line.trim();
            return trimmed.startsWith('|') && trimmed.endsWith('|');
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (isTableRow(line)) {
                const trimmed = line.trim();
                let cells = trimmed.split('|').map(c => c.trim());
                if (cells.length > 1) {
                    if (trimmed.startsWith('|')) cells.shift();
                    if (trimmed.endsWith('|')) cells.pop();
                }
                
                if (!inTable) {
                    inTable = true;
                    tableRows = [cells];
                } else {
                    tableRows.push(cells);
                }
            } else {
                if (inTable) {
                    resultLines.push(renderTable(tableRows));
                    inTable = false;
                    tableRows = [];
                }
                resultLines.push(line);
            }
        }
        
        if (inTable) {
            resultLines.push(renderTable(tableRows));
        }

        return resultLines.join('\n');
    };

    processed = parseMarkdownTables(processed);

    let html = processed
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
        // Lists
        .replace(/^\d+\.\s+(.*$)/gim, '<ol><li>$1</li></ol>') // Ordered
        .replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>') // Unordered
        // Separator
        .replace(/^(---|___|\*\*\*)\s*$/gim, '<hr>')
        // Formatting
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/\*(.*)\*/gim, '<i>$1</i>')
        .replace(/~~(.*)~~/gim, '<s>$1</s>')
        // Inline Code
        .replace(/`([^`]+)`/gim, '<code>$1</code>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    html = html.replace(/<\/ul>\s*<ul>/gim, '');
    html = html.replace(/<\/ol>\s*<ol>/gim, '');
    html = html.replace(/(<\/h[1-6]>|<\/blockquote>|<\/ul>|<\/ol>|<hr>|<\/table>|___CODE_BLOCK_\d+___)\n/gim, '$1');
    html = html.replace(/\n(<hr>)/gim, '$1');
    html = html.replace(/\n(___CODE_BLOCK_\d+___)/gim, '$1');
    html = html.replace(/\n/gim, '<br>');
    html = html.replace(/___CODE_BLOCK_(\d+)___/gim, (match, index) => {
        const codeContent = codeBlocks[parseInt(index, 10)];
        return `<pre class="bg-neutral-900 text-neutral-100 p-3 rounded-lg overflow-x-auto font-mono text-xs my-2">${codeContent}</pre>`;
    });

    return html;
};

export const htmlToMarkdown = (html: string): string => {
    if (!html) return '';

    const protectedWidgets: string[] = [];
    let processed = html.replace(/<!-- FINANCE_WIDGET_START -->[\s\S]*?<!-- FINANCE_WIDGET_END -->/gim, (match) => {
        protectedWidgets.push(match);
        return `___FINANCE_WIDGET_${protectedWidgets.length - 1}___`;
    });

    let markdown = processed
        .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gim, '```\n$1\n```\n')
        .replace(/<h1[^>]*>(.*?)<\/h1>/gim, '# $1\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gim, '## $1\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gim, '### $1\n')
        .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gim, '> $1\n')
        .replace(/<b>(.*?)<\/b>/gim, '**$1**')
        .replace(/<strong>(.*?)<\/strong>/gim, '**$1**')
        .replace(/<i>(.*?)<\/i>/gim, '*$1*')
        .replace(/<em>(.*?)<\/em>/gim, '*$1*')
        .replace(/<s>(.*?)<\/s>/gim, '~~$1~~')
        .replace(/<del>(.*?)<\/del>/gim, '~~$1~~')
        .replace(/<code[^>]*>(.*?)<\/code>/gim, '`$1`')
        .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gim, '[$2]($1)')
        .replace(/<hr[^>]*>/gim, '---\n')
        .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gim, (match, p1) => {
            let itemNum = 1;
            return p1.replace(/<li[^>]*>(.*?)<\/li>/gim, () => `${itemNum++}. $1\n`);
        })
        .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gim, (match, p1) => {
            return p1.replace(/<li[^>]*>(.*?)<\/li>/gim, '- $1\n');
        })
        .replace(/<p[^>]*>(.*?)<\/p>/gim, '$1\n')
        .replace(/<br\s*[\/]?>/gim, '\n')
        .replace(/<div>(.*?)<\/div>/gim, '$1\n')
        .replace(/&nbsp;/gim, ' ')
        .replace(/&amp;/gim, '&')
        .replace(/&lt;/gim, '<')
        .replace(/&gt;/gim, '>');

    markdown = markdown.replace(/___FINANCE_WIDGET_(\d+)___/gim, (match, index) => {
        return protectedWidgets[parseInt(index, 10)];
    });

    return markdown.trim();
};
