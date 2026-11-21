//! `random.Random` de Python, au bit près (copié de web_conquete) : Mersenne Twister (MT19937), la graine d'un
//! entier, et les tirages que le moteur emploie. La même graine rend les mêmes candidats, les mêmes offres, les
//! mêmes journées qu'avant le portage : les essais comparent le moteur à des références tirées du Python.

const N: usize = 624;
const M: usize = 397;

#[derive(Clone)]
pub struct Random {
    mt: [u32; N],
    idx: usize,
    /// Essais : `rng.random = lambda: valeur` du Python (les autres tirages ne changent pas).
    pub force: Option<f64>,
}

impl Random {
    /// `random.Random(graine)` d'un entier (son signe ne compte pas).
    pub fn new(graine: i64) -> Random {
        let a = graine.unsigned_abs();
        let cle: Vec<u32> = if a >> 32 != 0 { vec![a as u32, (a >> 32) as u32] } else { vec![a as u32] };
        Random::par_tableau(&cle)
    }

    fn init(s: u32) -> [u32; N] {
        let mut mt = [0u32; N];
        mt[0] = s;
        for i in 1..N {
            mt[i] = 1812433253u32.wrapping_mul(mt[i - 1] ^ (mt[i - 1] >> 30)).wrapping_add(i as u32);
        }
        mt
    }
    fn par_tableau(cle: &[u32]) -> Random {
        let mut mt = Random::init(19650218);
        let (mut i, mut j) = (1usize, 0usize);
        for _ in 0..N.max(cle.len()) {
            mt[i] = (mt[i] ^ (mt[i - 1] ^ (mt[i - 1] >> 30)).wrapping_mul(1664525)).wrapping_add(cle[j]).wrapping_add(j as u32);
            i += 1;
            j += 1;
            if i >= N {
                mt[0] = mt[N - 1];
                i = 1;
            }
            if j >= cle.len() {
                j = 0;
            }
        }
        for _ in 0..N - 1 {
            mt[i] = (mt[i] ^ (mt[i - 1] ^ (mt[i - 1] >> 30)).wrapping_mul(1566083941)).wrapping_sub(i as u32);
            i += 1;
            if i >= N {
                mt[0] = mt[N - 1];
                i = 1;
            }
        }
        mt[0] = 0x80000000;
        Random { mt, idx: N, force: None }
    }
    fn u32(&mut self) -> u32 {
        if self.idx >= N {
            let mt = &mut self.mt;
            for k in 0..N {
                let y = (mt[k] & 0x80000000) | (mt[(k + 1) % N] & 0x7fffffff);
                mt[k] = mt[(k + M) % N] ^ (y >> 1) ^ if y & 1 != 0 { 0x9908b0df } else { 0 };
            }
            self.idx = 0;
        }
        let mut y = self.mt[self.idx];
        self.idx += 1;
        y ^= y >> 11;
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^ (y >> 18)
    }

    /// `rng.random()` : dans [0, 1[.
    pub fn random(&mut self) -> f64 {
        if let Some(v) = self.force {
            return v;
        }
        let (a, b) = ((self.u32() >> 5) as f64, (self.u32() >> 6) as f64);
        (a * 67108864.0 + b) * (1.0 / 9007199254740992.0)
    }
    /// `rng.uniform(a, b)`.
    pub fn uniform(&mut self, a: f64, b: f64) -> f64 {
        a + (b - a) * self.random()
    }
    /// `rng.getrandbits(k)`, k de 1 à 64.
    fn getrandbits(&mut self, k: u32) -> u64 {
        if k <= 32 {
            (self.u32() >> (32 - k)) as u64
        } else {
            let bas = self.u32() as u64;
            bas | (((self.u32() >> (64 - k)) as u64) << 32)
        }
    }
    /// `rng._randbelow(n)` : un entier de [0, n[.
    #[track_caller]
    fn sous(&mut self, n: i64) -> i64 {
        assert!(n > 0, "ValueError: empty range for randrange()");
        let k = 64 - (n as u64).leading_zeros();
        loop {
            let r = self.getrandbits(k);
            if r < n as u64 {
                return r as i64;
            }
        }
    }
    /// `rng.randint(a, b)` : dans [a, b].
    #[track_caller]
    pub fn randint(&mut self, a: i64, b: i64) -> i64 {
        a + self.sous(b - a + 1)
    }
    /// `rng.choice(seq)` : le rang tiré dans une suite de n éléments.
    #[track_caller]
    pub fn choice_i(&mut self, n: usize) -> usize {
        assert!(n > 0, "IndexError: Cannot choose from an empty sequence");
        self.sous(n as i64) as usize
    }
    /// `rng.shuffle(v)`.
    pub fn shuffle<T>(&mut self, v: &mut [T]) {
        for i in (1..v.len()).rev() {
            let j = self.sous(i as i64 + 1) as usize;
            v.swap(i, j);
        }
    }
    /// `rng.sample(population, k)` : les rangs tirés, sans remise.
    #[track_caller]
    pub fn sample_i(&mut self, n: usize, k: usize) -> Vec<usize> {
        assert!(k <= n, "ValueError: Sample larger than population or is negative");
        let mut taille = 21usize;
        if k > 5 {
            taille += 4usize.pow(((k * 3) as f64).log(4.0).ceil() as u32);
        }
        let mut res = Vec::with_capacity(k);
        if n <= taille {
            let mut pool: Vec<usize> = (0..n).collect();
            for i in 0..k {
                let j = self.sous((n - i) as i64) as usize;
                res.push(pool[j]);
                pool[j] = pool[n - i - 1];
            }
        } else {
            for _ in 0..k {
                let mut j = self.sous(n as i64) as usize;
                while res.contains(&j) {
                    j = self.sous(n as i64) as usize;
                }
                res.push(j);
            }
        }
        res
    }
    /// `rng.choices(population, weights=poids)[0]` : le rang tiré selon les poids.
    #[track_caller]
    pub fn choix_pondere(&mut self, poids: &[f64]) -> usize {
        let mut cumul = Vec::with_capacity(poids.len());
        let mut s = 0.0;
        for (i, p) in poids.iter().enumerate() {
            s = if i == 0 { *p } else { s + p };
            cumul.push(s);
        }
        let total = *cumul.last().expect("IndexError: choices sans population") + 0.0;
        assert!(total > 0.0, "ValueError: Total of weights must be greater than zero");
        let x = self.random() * total;
        // bisect_right(cumul, x, 0, hi)
        let (mut lo, mut h) = (0usize, poids.len() - 1);
        while lo < h {
            let mid = (lo + h) / 2;
            if x < cumul[mid] {
                h = mid
            } else {
                lo = mid + 1
            }
        }
        lo
    }
}

/// Une graine neuve, pour `random.Random()` sans graine.
pub fn graine_hasard() -> i64 {
    use std::hash::{BuildHasher, Hasher};
    // RandomState tire ses clés du système à chaque processus : c'est le hasard de la bibliothèque standard
    let mut h = std::collections::hash_map::RandomState::new().build_hasher();
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_nanos()));
    (h.finish() >> 1) as i64
}
