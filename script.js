(function() {
	const repoUrl = document.getElementById('repoUrl');
	const output = document.getElementById('output');
	const status = document.getElementById('status');
	const goBtn = document.getElementById('goBtn');
	const copyBtn = document.getElementById('copyBtn');
	const toggleToken = document.getElementById('toggleToken');
	const tokenRow = document.getElementById('tokenRow');
	const tokenInput = document.getElementById('tokenInput');

	function setStatus(s) {
		status.textContent = 'State: ' + s;
	}

	function parseGitHubUrl(url) {
		try {
			url = url.trim();
			if (!url) return null;
			url = url.replace(/\.git\/?$/, '');
			const u = new URL(url);
			if (!/github.com$/i.test(u.hostname)) return null;
			const parts = u.pathname.split('/').filter(Boolean);
			if (parts.length < 2) return null;
			const owner = parts[0];
			const repo = parts[1];
			let branch = undefined;
			if (parts.length >= 4 && (parts[2] === 'tree' || parts[2] === 'blob')) branch = parts[3];
			return {
				owner,
				repo,
				branch
			};
		} catch (e) {
			return null;
		}
	}

	async function fetchJson(url, token) {
		const headers = {
			'Accept': 'application/vnd.github.v3+json'
		};
		if (token) headers['Authorization'] = 'token ' + token;
		const res = await fetch(url, {
			headers
		});
		if (!res.ok) {
			const txt = await res.text().catch(() => res.statusText);
			throw new Error(res.status + ' ' + txt);
		}
		return res.json();
	}

	async function getDefaultBranch(owner, repo, token) {
		const api = `https://api.github.com/repos/${owner}/${repo}`;
		const j = await fetchJson(api, token);
		return j.default_branch || 'main';
	}

	async function getTree(owner, repo, branch, token) {
		const api = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
		return fetchJson(api, token);
	}

	function makeRawUrl(owner, repo, branch, path) {
		return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
	}

	async function flatten(urlString) {
		const parsed = parseGitHubUrl(urlString);
		if (!parsed) {
			setStatus('URL is not valid');
			output.value = '';
			return;
		}
		const {
			owner,
			repo,
			branch: branchFromUrl
		} = parsed;
		const token = tokenInput.value.trim() || undefined;
		setStatus('Getting repo\'s information');
		try {
			const branch = branchFromUrl || await getDefaultBranch(owner, repo, token);
			setStatus('Getting repo\'s files tree');
			const treeResp = await getTree(owner, repo, branch, token);
			if (treeResp.truncated) {
				setStatus('Kết quả bị cắt (truncated). Hãy cung cấp token để tăng rate limit hoặc xuất repo local.');
			} else {
				setStatus('Tải xong. Xử lý...');
			}
			const blobs = (treeResp.tree || []).filter(e => e.type === 'blob');
			blobs.sort((a, b) => a.path.localeCompare(b.path));
			const lines = blobs.map(b => `${b.path}: ${makeRawUrl(owner, repo, branch, b.path)}`);
			output.value = lines.join('\n');
			setStatus(`Hoàn thành. ${lines.length} file.`);
		} catch (err) {
			console.error(err);
			setStatus('Lỗi: ' + err.message);
			output.value = '';
		}
	}

	goBtn.addEventListener('click', () => {
		const v = repoUrl.value.trim();
		if (!v) {
			setStatus('Nhập URL trước');
			return;
		}
		flatten(v);
	});
	copyBtn.addEventListener('click', () => {
		output.select();
		document.execCommand('copy');
		setStatus('Đã sao chép ô 2');
	});
	toggleToken.addEventListener('click', () => {
		tokenRow.style.display = tokenRow.style.display === 'none' ? 'block' : 'none';
		tokenInput.focus();
	});

	repoUrl.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			const v = repoUrl.value.trim();
			if (v) flatten(v);
		}
	});

})();
