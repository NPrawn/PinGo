/** A help request raised by a user and queued for a counselor. */
export type ConsultRequest = {
  type: string;
  /** Clock time the request came in. */
  time: string;
  /** How long the user has been waiting. */
  wait: string;
  /** Where the user is inside the station. */
  loc: string;
  detail: string;
};

/** One line of a past conversation. */
export type ConsultLogEntry = {
  who: string;
  text: string;
};

/** A completed consultation, shown in the counselor's history. */
export type ConsultHistoryEntry = {
  agent: string;
  date: string;
  summary: string;
  from: string;
  exit: string;
  option: string;
  lang: string;
  log: readonly ConsultLogEntry[];
};
