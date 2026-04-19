# 687333G
from fractions import Fraction
import sys
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
prefixsum: list[Fraction] = [Fraction()] * (l+1)
for i in range(1, l+1):
    attempts: Fraction = Fraction(100,pigs[i][1])
    prefix = prefixsum[pigs[i][2]-1]
    loop_sum = prefixsum[i-1] - prefixsum[pigs[i][2]-1] + pigs[i][0]
    # print(prefixsum)
    # print(prefix, loop_sum, attempts, pigs[i])
    prefixsum[i] = prefix + loop_sum * attempts % m
# print(prefixsum)
# Function to return the GCD 
# of given numbers
w = prefixsum[-1].denominator, m-2, m;
print(prefixsum[-1].numerator * w)
def gcd(a, b):

    if (a == 0):
        return b
    return gcd(b % a, a)

# Recursive function to return (x ^ n) % m
def modexp(x, n):

    if (n == 0) :
        return 1
    
    elif (n % 2 == 0) :
        return modexp((x * x) % m, n // 2)
    
    else :
        return (x * modexp((x * x) % m, 
                           (n - 1) / 2) % m)


# Function to return the fraction modulo mod
def getFractionModulo(a, b):

    c = gcd(a, b)

    a = a // c
    b = b // c

    # (b ^ m-2) % m
    d = modexp(b, m - 2)

    # Final answer
    ans = ((a % m) * (d % m)) % m

    return ans


print (getFractionModulo(prefixsum[-1].numerator, prefixsum[-1].denominator))
# inv = pow(prefixsum[-1].denominator, -1, (10*9)+7)
# print(prefixsum[-1].numerator * inv)
