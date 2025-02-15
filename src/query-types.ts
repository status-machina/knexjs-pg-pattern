import type { Knex } from "knex";

export type QueryOperators<T> = {
  eq?: T;
  neq?: T;
  in?: T[];
  nin?: T[];
  gt?: T;
  gte?: T;
  lt?: T;
  lte?: T;
};

export type DataFilter = {
  [key: string]: QueryOperators<string | number | boolean>;
};

type QueryBuilder = {
  whereData: (field: string, operator: keyof QueryOperators<any>, value: any) => Knex.QueryBuilder;
};

export const operatorMap: Record<keyof QueryOperators<any>, string> = {
  eq: '=',
  neq: '!=',
  in: 'IN',
  nin: 'NOT IN',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<='
}; 