import {MixerService} from '../../services/MixerService'

export function useMixer() {
    return {
        getAll: MixerService.getAllMixers?.bind(MixerService) || MixerService.getAllMixers,
        fetchAll: MixerService.fetchMixers?.bind(MixerService) || MixerService.fetchMixers,
        getById: MixerService.getMixerById?.bind(MixerService) || MixerService.getMixerById,
        fetchById: MixerService.fetchMixerById?.bind(MixerService) || MixerService.fetchMixerById,
        create: MixerService.createMixer?.bind(MixerService) || MixerService.createMixer,
        update: MixerService.updateMixer?.bind(MixerService) || MixerService.updateMixer,
        delete: MixerService.deleteMixer?.bind(MixerService) || MixerService.deleteMixer,
        fetchComments: MixerService.fetchComments?.bind(MixerService) || MixerService.fetchComments,
        addComment: MixerService.addComment?.bind(MixerService) || MixerService.addComment,
        deleteComment: MixerService.deleteComment?.bind(MixerService) || MixerService.deleteComment,
        fetchHistory: MixerService.getMixerHistory?.bind(MixerService) || MixerService.getMixerHistory,
        fetchIssues: MixerService.fetchIssues?.bind(MixerService) || MixerService.fetchIssues,
        addIssue: MixerService.addIssue?.bind(MixerService) || MixerService.addIssue,
        completeIssue: MixerService.completeIssue?.bind(MixerService) || MixerService.completeIssue,
        deleteIssue: MixerService.deleteIssue?.bind(MixerService) || MixerService.deleteIssue
    }
}

export default useMixer

