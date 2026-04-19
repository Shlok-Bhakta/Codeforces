# 687333G
l = int(input())
# print(l)
m = (10**9) + 7
pigs: list[list[int]] = []
pigs.append([0, 100, 0])
for i in range(l):
    a, b, c = [int(a) for a in input().split(" ")]
    # print(a, b, c)
    pigs.append([a, b, c])
# print(pigs)
prefixsum: list[int] = [0] * (l+1)
for i in range(1, l+1):
    prefix = prefixsum[pigs[i][2]-1]
    loop_sum = prefixsum[i-1] - prefixsum[pigs[i][2]-1] + pigs[i][0]
    # print(prefixsum)
    # print(prefix, loop_sum, attempts, pigs[i])
    d = pigs[i][1]
    n = prefix*d + (loop_sum * 100)
    w = n * pow(d, m-2, m) % m;
    prefixsum[i] = w
print(prefixsum[-1])
    
# print(prefixsum)
# Function to return the GCD 
# of given numbers
