import random
n = random.randint(1,10000 )
m = random.randint(0,10000 )
pairs = set()
for i in range(m):
    u = random.randint(1,n )
    v = random.randint(1,n )
    while(v == u):
        v = random.randint(1,n )
    pair = (u, v)
    while pair in pairs:
        u = random.randint(1,n )
        v = random.randint(1,n )
        while(v == u):
            v = random.randint(1,n )
        pair = (u, v)
    pairs.add(pair);
print(n, m)
print("\n".join([f"{p[0]} {p[1]}" for p in pairs]));
