import * as https from 'https';
import {
    GitProvider,
    GitPlatform,
    GitFilterConfig,
    MergeRequest,
    MergeRequestApproval,
} from '../../models/gitMergeRequestTypes';

export class GitlabProvider implements GitProvider {
    readonly platform: GitPlatform = 'gitlab';

    async validateConnection(url: string, token: string): Promise<{ user: string }> {
        const response = await this.apiGet(url, token, '/api/v4/user');
        const data = JSON.parse(response);
        return { user: data.username || data.name };
    }

    async fetchAssignedMergeRequests(
        url: string,
        token: string,
        user: string,
        config: GitFilterConfig,
    ): Promise<MergeRequest[]> {
        const params = 'state=opened&scope=assigned_to_me&per_page=50&order_by=updated_at';
        const response = await this.apiGet(url, token, `/api/v4/merge_requests?${params}`);
        const items = JSON.parse(response) as any[];
        const mergeRequests: MergeRequest[] = [];

        for (const item of items) {
            const mergeRequest = this.mapMergeRequest(item, url, user);
            if (!config.showDrafts && mergeRequest.isDraft) {
                continue;
            }
            if (config.projectPaths.length > 0) {
                const pathLower = mergeRequest.projectPath.toLowerCase();
                const matches = config.projectPaths.some((p) => pathLower === p.toLowerCase());
                if (!matches) {
                    continue;
                }
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
        const params =
            'state=opened&scope=all&reviewer_username=' +
            encodeURIComponent(user) +
            '&per_page=50&order_by=updated_at';
        const response = await this.apiGet(url, token, `/api/v4/merge_requests?${params}`);
        const items = JSON.parse(response) as any[];
        const mergeRequests: MergeRequest[] = [];

        for (const item of items) {
            const mergeRequest = this.mapMergeRequest(item, url, user);
            if (!config.showDrafts && mergeRequest.isDraft) {
                continue;
            }
            if (config.projectPaths.length > 0) {
                const pathLower = mergeRequest.projectPath.toLowerCase();
                const matches = config.projectPaths.some((p) => pathLower === p.toLowerCase());
                if (!matches) {
                    continue;
                }
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
        projectPath: string,
        mergeRequestIid: number,
    ): Promise<MergeRequestApproval> {
        const encodedPath = encodeURIComponent(projectPath);
        const path = `/api/v4/projects/${encodedPath}/merge_requests/${mergeRequestIid}/approvals`;
        const response = await this.apiGet(url, token, path);
        const data = JSON.parse(response);
        return {
            required: data.approvals_required || 0,
            given:
                data.approvals_left != null
                    ? (data.approvals_required || 0) - data.approvals_left
                    : (data.approved_by || []).length,
        };
    }

    private mapMergeRequest(item: any, baseUrl: string, currentUser: string): MergeRequest {
        const webUrl: string = item.web_url || '';
        const projectPath = this.extractProjectPath(webUrl, baseUrl);
        const iid = parseInt(String(item.iid), 10) || 0;
        const projectId = parseInt(String(item.project_id), 10) || 0;

        return {
            id: `gitlab-${iid}-${projectId}`,
            platform: 'gitlab',
            number: iid,
            title: item.title || '',
            state: item.state === 'merged' ? 'merged' : item.state === 'closed' ? 'closed' : 'open',
            author: item.author?.username || '',
            url: webUrl || `${baseUrl}/${projectPath}/-/merge_requests/${iid}`,
            projectPath: projectPath,
            sourceBranch: item.source_branch || '',
            targetBranch: item.target_branch || '',
            updatedAt: item.updated_at || '',
            isDraft: item.draft === true || (item.title || '').startsWith('Draft:'),
            approval: null,
            isAuthor: (item.author?.username || '').toLowerCase() === currentUser.toLowerCase(),
        };
    }

    private extractProjectPath(webUrl: string, baseUrl: string): string {
        if (!webUrl) {
            return '';
        }
        const withoutBase = webUrl.replace(baseUrl, '').replace(/^\/?/, '');
        const mrIndex = withoutBase.indexOf('/-/merge_requests/');
        if (mrIndex > 0) {
            return withoutBase.substring(0, mrIndex);
        }
        return '';
    }

    private apiGet(baseUrl: string, token: string, path: string): Promise<string> {
        const fullUrl = new URL(path, baseUrl);

        return new Promise((resolve, reject) => {
            const request = https.get(
                fullUrl.toString(),
                {
                    headers: {
                        'PRIVATE-TOKEN': token,
                        Accept: 'application/json',
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
