export interface ParsedStatement {
  closingDate: Date;
  dueDate: Date;
  totalAmount: number;
  minPayment: number;
  currency: string;
  items: ParsedStatementItem[];
}

export interface ParsedStatementItem {
  date: Date;
  description: string;
  amount: number;
  currency: string;
}

export interface IStatementParser {
  parse(fileBuffer: Buffer): Promise<ParsedStatement>;
}