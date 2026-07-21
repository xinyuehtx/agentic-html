declare module 'diff-match-patch' {
  type Diff = [number, string];

  class diff_match_patch {
    DIFF_DELETE: -1;
    DIFF_INSERT: 1;
    DIFF_EQUAL: 0;

    diff_main(text1: string, text2: string, opt_checklines?: boolean): Diff[];
    diff_cleanupSemantic(diffs: Diff[]): void;
    diff_cleanupEfficiency(diffs: Diff[]): void;
    diff_levenshtein(diffs: Diff[]): number;
    diff_prettyHtml(diffs: Diff[]): string;

    patch_make(text1: string, text2: string): unknown[];
    patch_make(diffs: Diff[]): unknown[];
    patch_apply(patches: unknown[], text: string): [string, boolean[]];

    match_main(text: string, pattern: string, loc: number): number;
  }

  export default diff_match_patch;
}
