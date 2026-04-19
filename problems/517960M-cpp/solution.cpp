// 517960M
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
vector<string> strsep(string &t){
  stringstream ss(t);
  string word;
  vector<string> words;
  while(ss >> word){
    words.pb(word);
  }
  return words;
}

void solve(){
  int N, L, Q;
  cin >> N >> L >> Q;
  unordered_map<string, string> etos;
  unordered_map<string, string> stoe;
  rep(i, N){
    string s, m, e;
    cin >> s >> m >> e;
    etos[s] = e;
    stoe[e] = s;
  }
  cpp_dump(etos, stoe);
  string p;
  getline(cin, p);
  getline(cin, p);
  getline(cin, p);
  vector<string> phrase = strsep(p);
  cpp_dump(phrase);
  getline(cin, p);
  rep(i, Q){
    getline(cin, p);
    vector<string> comp = strsep(p);
    cpp_dump(p);
    // map words
    rep(j, L){
      // replace all known with spanish and all unknown with ???
      comp[j] = (etos.contains(comp[j])) ? etos[comp[j]] : "???";
    }
    yn(comp == phrase);
  }
}

int32_t main(){
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);
    // tc{ solve(); }
    solve();
}
