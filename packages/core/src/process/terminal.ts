import { Terminal } from "@xterm/headless";

export type CellData = {
  char: string;
  fg: number;
  bg: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  inverse: boolean;
  strikethrough: boolean;
};

export class VirtualTerminal {
  private terminal: Terminal;

  constructor(cols = 80, rows = 24) {
    this.terminal = new Terminal({ cols, rows, allowProposedApi: true });
  }

  write(data: string): void {
    this.terminal.write(data);
  }

  writeSync(data: string): Promise<void> {
    return new Promise((resolve) => {
      this.terminal.write(data, resolve);
    });
  }

  getCell(row: number, col: number): CellData | null {
    const buffer = this.terminal.buffer.active;
    const line = buffer.getLine(row);
    if (!line) return null;

    const cell = line.getCell(col);
    if (!cell) return null;

    return {
      char: cell.getChars() || " ",
      fg: cell.getFgColor(),
      bg: cell.getBgColor(),
      bold: !!(cell.isBold && cell.isBold()),
      italic: !!(cell.isItalic && cell.isItalic()),
      underline: !!(cell.isUnderline && cell.isUnderline()),
      inverse: !!(cell.isInverse && cell.isInverse()),
      strikethrough: !!(cell.isStrikethrough && cell.isStrikethrough()),
    };
  }

  getDimensions(): { cols: number; rows: number } {
    return { cols: this.terminal.cols, rows: this.terminal.rows };
  }

  getCursorPosition(): { row: number; col: number } {
    const buffer = this.terminal.buffer.active;
    return { row: buffer.cursorY, col: buffer.cursorX };
  }

  getLine(row: number): string {
    const buffer = this.terminal.buffer.active;
    const line = buffer.getLine(row);
    if (!line) return "";
    return line.translateToString(true);
  }

  getScreenContent(): string {
    const lines: string[] = [];
    for (let i = 0; i < this.terminal.rows; i++) {
      lines.push(this.getLine(i));
    }
    return lines.join("\n");
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows);
  }

  dispose(): void {
    this.terminal.dispose();
  }
}
