// {{PROBLEM_ID}}
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

typedef long long ll;
typedef unsigned long long ull;
typedef pair<int, int> pii;
typedef pair<ll, ll> pll;
typedef vector<int> vi;
typedef vector<ll> vll;
typedef vector<pii> vpii;
typedef vector<pll> vpll;

#define pb push_back
#define mp make_pair
#define all(x) (x).begin(), (x).end()
#define sz(x) (int)(x).size()
#define F first
#define S second

const int INF = 1e9;
const ll LINF = 1e18;
const int MOD = 1e9 + 7;

#define fastio ios_base::sync_with_stdio(false), cin.tie(nullptr);

void solve() {}

int main() {
  fastio;
  solve();
}
