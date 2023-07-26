export const feedURI = "at://did:web:feed.zyntaks.ca/app.bsky.feed.generator/";

export function mergeSorted<T>(arr1: T[], arr2: T[], compareLessThan: (a: T, b: T) => boolean) {
    let merged: T[] = [];
    let index1 = 0;
    let index2 = 0;
    let current = 0;

    while (current < (arr1.length + arr2.length)) {

        let isArr1Depleted = index1 >= arr1.length;
        let isArr2Depleted = index2 >= arr2.length;

        if (!isArr1Depleted && (isArr2Depleted || compareLessThan(arr1[index1], arr2[index2]))) {
            merged[current] = arr1[index1];
            index1++;
        } else {
            merged[current] = arr2[index2];
            index2++;
        }

        current++;
    }

    return merged;
}
