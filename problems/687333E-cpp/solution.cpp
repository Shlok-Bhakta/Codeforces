// 687333E
#ifdef LOCAL_DEBUG
#include <cpp-dump.hpp>
namespace cp = cpp_dump;
CPP_DUMP_SET_OPTION_GLOBAL(es_style, cp::types::es_style_t::no_es);
CPP_DUMP_SET_OPTION_GLOBAL(log_label_func, [](auto, auto, auto) { return ""; });
#else
#define cpp_dump(...)
#endif

#include <bits/stdc++.h>
using namespace std;

#define int long long

typedef unsigned long long ull;
typedef pair<int,int> pii;
typedef vector<int> vi;
typedef vector<pii> vpii;
typedef vector<vi> vvi;

#define rep(i,n)     for(int i=0;i<(int)(n);i++)
#define rep1(i,n)    for(int i=1;i<=(int)(n);i++)
#define rrep(i,n)    for(int i=(int)(n)-1;i>=0;i--)
#define fore(i,a,b)  for(int i=(a);i<(int)(b);i++)
#define each(x,v)    for(auto& x:v)

#define pb    push_back
#define eb    emplace_back
#define all(x) (x).begin(),(x).end()
#define sz(x)  (int)(x).size()
#define F     first
#define S     second
#define nl    "\n"

#define chmin(a,b) a=min(a,b)
#define chmax(a,b) a=max(a,b)

#define yn(b)      cout<<((b)?"YES":"NO")<<nl
#define printv(v)  for(auto& _x:v)cout<<_x<<" ";cout<<nl
#define readv(v,n) v.resize(n);rep(i,n)cin>>v[i]
#define sumv(v)    accumulate(all(v),0LL)
#define minv(v)    *min_element(all(v))
#define maxv(v)    *max_element(all(v))
#define rsort(v)   sort((v).rbegin(),(v).rend())
#define tc         int _t;cin>>_t;while(_t--)

template<typename T>
inline int idx(const vector<T>& v,int i){return i<0?(int)v.size()+i:i;}

#ifdef LOCAL_DEBUG
#define dbg(x) cerr<<#x<<" = "<<(x)<<nl
#else
#define dbg(x)
#endif

const int INF  = 2e18;
const int MOD  = 1e9+7;

struct Edge{
  int neighbor;
  int depth;
};


unordered_set<int> findComponents(unordered_map<int, vi> &graph){
  unordered_set<int> res;
  unordered_set<int> visited;
  each(key, graph){
    if(!visited.contains(key.F)){
      stack<int> s;
      s.push(key.F);
      while(!s.empty()){
        int cur = s.top();
        s.pop();
        // queue up all the children not visited
        each(val, graph[key.F]){
          if(visited.contains(val)){
            continue;
          }
          cpp_dump(key, val);
          visited.insert(val);
          s.push(val);
        }
      }
      res.insert(key.F);
    }
  }
  return res;
}


int nDE(unordered_map<int, vi>  &graph){
  queue<pair<int, int>> q;
  unordered_map<int, int> depth;
  unordered_set<int> visited;
  unordered_set<int> components = findComponents(graph);
  cpp_dump(components);
  each(key, components){
    q.push({key, 0});
  }
  cpp_dump(q);
  while(sz(q) > 0){
    auto [node, d] = q.front();
    q.pop();
    if(visited.contains(node)) continue;
    visited.add(node);
    depth[node] = d;
    each(neighbor in graph[node]){
      if(depth.contains(neighbor) and depth[neighbor] == d){

      }
    }
  }

  return sz(components);
}

void solve(){
  int tnt, pairs;
  cin >> tnt >> pairs;
  unordered_map<int, vi> graph;
  rep(i, pairs){
    int u, v;
    cin >> u >> v;
    graph[u-1].pb(v-1);
    graph[v-1].pb(u-1);
  }
  cpp_dump(tnt, pairs, graph);
  cpp_dump(nDE(graph));
  yn(nDE(graph));
}

int32_t main(){
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    // tc{ solve(); }
    solve();
}
