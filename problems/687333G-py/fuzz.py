import random
n = random.randint(1,10000 )
pairs = set()
for i in range(n):
    u = random.randint(1,1000000000+1 )
    v = random.randint(1,100+1 )
    w = random.randint(1, i+1)
    pair = (u, v, w)
    pairs.add(pair);
print(n)
print("\n".join([f"{p[0]} {p[1]} {p[2]}" for p in pairs]));
