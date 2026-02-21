// 2192B
#include <vector>
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
void step(int idx, vector<bool> &s){
  s.flip();
  s[idx] = !s[idx];
}

bool iswin(vector<bool> &s){
  return none_of(all(s), [](bool b){ return b; });
}

void solve(){
  int n;
  string binstring;
  vector<bool> s;
  cin >> n >> binstring;
  int ones = 0;
  int zeros = 0;
  rep(i, binstring.size()){
    bool val = (binstring[i] == '1') ? true : false;
    s.push_back(val);
    ones += val;
    zeros += !val;
  }
  // 0000 case
  if(iswin(s)){
    cpp_dump(s);
    cout << 0 << nl;

    cpp_dump("===");
    return;
  }

  // // trivial case
  // if(zeros == 1){
  //   cpp_dump(s);
  //   auto it = find(all(s), false);
  //   int index = distance(s.begin(), it);
  //   cout << 1 << nl;
  //   cout << index+1 << nl;
  //   cpp_dump("===");
  //   return;
  // }
  // we alternate in a pattern 1 0 1 0 if we end at a 0 and cant find a 0 then we give up
  bool cur = true;
  vi steps;
  int z, o;
  z = zeros;
  o = ones;
  rep(i, ones*2){
    cpp_dump(s, steps);
    if(z == 1){
      auto it = find(all(s), false);
      int index = distance(s.begin(), it);
      step(index, s);
      cpp_dump(s);
      steps.push_back(index);
    }
    if(iswin(s)){
      cout << steps.size() << nl;
      rep(j, steps.size()){
        cout << steps[j]+1 << " ";
      }
      cout << nl;
      cpp_dump("===");
      return;
    }
    auto it = find(all(s), cur);
    int index = distance(s.begin(), it);
    if(index >= s.size()){
      break;
    }
    // flip it
    step(index, s);
    steps.push_back(index);
    cur = !cur;
  }
  cout << "-1" << endl;
  cpp_dump("===");
}

int32_t main(){
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    tc{ solve(); }
    // solve();
}
