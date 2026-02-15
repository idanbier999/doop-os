import { type ReactNode, type ThHTMLAttributes, type TdHTMLAttributes, type HTMLAttributes } from "react";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

export function Table({ children, className = "", ...props }: TableProps) {
  return (
    <div className="overflow-x-auto border border-mac-black">
      <table className={`w-full text-sm text-left ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export interface TheadProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export function Thead({ children, className = "", ...props }: TheadProps) {
  return (
    <thead className={`border-b-2 border-mac-black bg-mac-light-gray text-xs uppercase text-mac-black font-bold ${className}`} {...props}>
      {children}
    </thead>
  );
}

export interface TbodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
  striped?: boolean;
}

export function Tbody({ children, striped = false, className = "", ...props }: TbodyProps) {
  return (
    <tbody
      className={`divide-y divide-mac-black ${striped ? "[&>tr:nth-child(even)]:bg-mac-cream" : ""} ${className}`}
      {...props}
    >
      {children}
    </tbody>
  );
}

export interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
}

export function Tr({ children, className = "", ...props }: TrProps) {
  return (
    <tr className={`hover:bg-mac-light-gray transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
}

export interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function Th({ children, className = "", ...props }: ThProps) {
  return (
    <th className={`px-4 py-2 font-bold border-r border-mac-black last:border-r-0 font-[family-name:var(--font-pixel)] ${className}`} {...props}>
      {children}
    </th>
  );
}

export interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function Td({ children, className = "", ...props }: TdProps) {
  return (
    <td className={`px-4 py-2 text-mac-black border-r border-mac-black last:border-r-0 ${className}`} {...props}>
      {children}
    </td>
  );
}
