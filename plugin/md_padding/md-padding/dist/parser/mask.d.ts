/**
 * By default all nodes are allowd to nest within another,
 * each node defines a list (a bitstring we call `mask`)
 * of disallowd desendant types.
 *
 * Assume the `mask` do not distinguish direct or indirect
 * child, so it's resonable to maintain a total mask
 * combining all ancestors' masks.
 */
export declare class Mask {
    mask: number;
    private counts;
    add(bitstring: number): void;
    remove(bitstring: number): void;
}
