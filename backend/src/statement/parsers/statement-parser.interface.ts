export interface ParsedStatement {
  closingDate: Date;
  dueDate: Date;
  totalAmount: number;
  minPayment: number;
  currency: string;
  items: ParsedStatementItem[];
  // Card metadata extracted from statement
  creditLimit?: number;
  financingRate?: number;  // Annual TNA %
}

export interface ParsedStatementItem {
  date: Date;
  description: string;
  amount: number;
  currency: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

export interface IStatementParser {
  parse(fileBuffer: Buffer): Promise<ParsedStatement>;
  parseText(text: string): ParsedStatement;
}