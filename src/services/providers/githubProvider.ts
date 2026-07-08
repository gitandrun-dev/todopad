import * as https from 'https';
import {
    GitProvider,
    GitPlatform,
    GitFilterConfig,
    MergeRequest,
    MergeRequestApproval,
} from '../../models/gitMergeRequestTypes';

export class GithubProvider implements GitProvider {
    readonly platform: GitPlatform = 'github';

    async validateConnection(url: string, token: string): Promise<{ user: string }> {
        const response = await this.apiGet(url, token, '/user');
        const data = JSON.parse(response);
        return { user: data.login || data.name };
    }

    async fetchAssignedMergeRequests(
        url: string,
        token: string,
        user: string,
        config: GitFilterConfig,
    ): Promise<MergeRequest[]> {
        let query = `type:pr state:open assignee:${encodeURIComponent(user)}`;
        if (config.projectPaths.length > 0) {
            const repoQueries = config.projectPaths.map((p) => `repo:${p}`).join(' ');
            query += ` ${repoQueries}`;
        }

        const path = `/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=50`;
        const response = await this.apiGet(url, token, path);
        const data = JSON.parse(response);
        const items = data.items || [];
        const mergeRequests: MergeRequest[] = [];

        for (const item of items) {
            const mergeRequest = this.mapSearchResult(item, user);
            if (!config.showDrafts && mergeRequest.isDraft) {
                continue;
            }
            mergeRequests.push(mergeRequest);
        }

        return this.enrichApprovals(url, token, mergeRequests);
    }

    async fetchReviewRequestedMergeRequests(
        url: string,
        token: string,
        user: string,
        config: GitFilterConfig,
    ): Promise<MergeRequest[]> {
        let query = `type:pr state:open review-requested:${encodeURIComponent(user)}`;
        if (config.projectPaths.length > 0) {
            const repoQueries = config.projectPaths.map((p) => `repo:${p}`).join(' ');
            query += ` ${repoQueries}`;
        }

        const path = `/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=50`;
        const response = await this.apiGet(url, token, path);
        const data = JSON.parse(response);
        const items = data.items || [];
        const mergeRequests: MergeRequest[] = [];

        for (const item of items) {
            const mergeRequest = this.mapSearchResult(item, user);
            if (!config.showDrafts && mergeRequest.isDraft) {
                continue;
            }
            mergeRequests.push(mergeRequest);
        }

        return mergeRequests;
    }

    private async enrichApprovals(
        url: string,
        token: string,
        mergeRequests: MergeRequest[],
    ): Promise<MergeRequest[]> {
        const enriched: MergeRequest[] = [];

        for (const mergeRequest of mergeRequests) {
            if (mergeRequest.isAuthor) {
                try {
                    const approval = await this.fetchApprovalStatus(
                        url,
                        token,
                        mergeRequest.projectPath,
                        mergeRequest.number,
                    );
                    enriched.push({ ...mergeRequest, approval });
                } catch {
                    enriched.push(mergeRequest);
                }
            } else {
                enriched.push(mergeRequest);
            }
        }

        return enriched;
    }

    private async fetchApprovalStatus(
        url: string,
        token: string,
        repoPath: string,
        pullNumber: number,
    ): Promise<MergeRequestApproval> {
        const safePullNumber = parseInt(String(pullNumber), 10);
        if (!repoPath || isNaN(safePullNumber)) {
            return { required: 0, given: 0 };
        }
        const encodedRepo = repoPath
            .split('/')
            .map((segment) => encodeURIComponent(segment))
            .join('/');
        const reviewsPath = `/repos/${encodedRepo}/pulls/${safePullNumber}/reviews`;
        const response = await this.apiGet(url, token, reviewsPath);
        const reviews = JSON.parse(response) as any[];

        const latestByUser = new Map<string, string>();
        for (const review of reviews) {
            if (review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED') {
                latestByUser.set(review.user.login, review.state);
            }
        }

        const approvedCount = [...latestByUser.values()].filter((s) => s === 'APPROVED').length;

        let required = 1;
        try {
            const branchPath = `/repos/${encodedRepo}/branches/main`;
            const branchResponse = await this.apiGet(url, token, branchPath);
            const branchData = JSON.parse(branchResponse);
            const protection = branchData.protection;
            if (protection?.required_pull_request_reviews?.required_approving_review_count) {
                required = protection.required_pull_request_reviews.required_approving_review_count;
            }
        } catch {
            // Branch protection info not accessible, default to 1
        }

        return {
            required,
            given: approvedCount,
        };
    }

    private mapSearchResult(item: any, currentUser: string): MergeRequest {
        const htmlUrl = item.html_url || '';
        const repoPath = this.extractRepoPath(htmlUrl);
        const author = item.user?.login || '';
        const number = parseInt(String(item.number), 10) || 0;

        return {
            id: `github-${number}-${repoPath}`,
            platform: 'github',
            number: number,
            title: item.title || '',
            state: item.state === 'closed' ? 'closed' : 'open',
            author: author,
            url: htmlUrl,
            projectPath: repoPath,
            sourceBranch: item.head?.ref || '',
            targetBranch: item.base?.ref || '',
            updatedAt: item.updated_at || '',
            isDraft: item.draft === true || (item.title || '').startsWith('[WIP]'),
            approval: null,
            isAuthor: author.toLowerCase() === currentUser.toLowerCase(),
        };
    }

    private extractRepoPath(htmlUrl: string): string {
        const match = htmlUrl.match(/github\.com\/([^/]+\/[^/]+)\/pull/);
        if (match) {
            return match[1];
        }
        const enterpriseMatch = htmlUrl.match(/\/([^/]+\/[^/]+)\/pull/);
        return enterpriseMatch ? enterpriseMatch[1] : '';
    }

    private apiGet(baseUrl: string, token: string, path: string): Promise<string> {
        const apiBase = baseUrl.includes('github.com')
            ? 'https://api.github.com'
            : baseUrl + '/api/v3';
        const fullUrl = new URL(path, apiBase);

        return new Promise((resolve, reject) => {
            const request = https.get(
                fullUrl.toString(),
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/vnd.github+json',
                        'User-Agent': 'TodoPad-VSCode-Extension',
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                },
                (response) => {
                    const statusCode = response.statusCode || 0;
                    if (statusCode === 401 || statusCode === 403) {
                        reject(new Error(`${statusCode} Unauthorized`));
                        response.resume();
                        return;
                    }
                    if (statusCode < 200 || statusCode >= 300) {
                        reject(new Error(`HTTP ${statusCode}`));
                        response.resume();
                        return;
                    }

                    let body = '';
                    response.setEncoding('utf-8');
                    response.on('data', (chunk) => {
                        body += chunk;
                    });
                    response.on('end', () => resolve(body));
                    response.on('error', reject);
                },
            );
            request.on('error', reject);
        });
    }
}
