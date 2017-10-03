class WaitForClusterCreationWorker
  include Sidekiq::Worker
  include DedicatedSidekiqQueue

  INITIAL_INTERVAL = 2.minutes
  EAGER_INTERVAL = 10.seconds
  TIMEOUT = 20.minutes

  def perform(cluster_id)
    Gcp::Cluster.find_by_id(cluster_id).try do |cluster|
      Ci::FetchGcpOperationService.new.execute(cluster) do |operation|
        case operation.status
        when 'RUNNING'
          if TIMEOUT < Time.now - operation.start_time.to_time
            return cluster.errored!("Cluster creation time exceeds timeout; #{TIMEOUT}")
          end

          WaitForClusterCreationWorker.perform_in(EAGER_INTERVAL, cluster.id)
        when 'DONE'
          Ci::FinalizeClusterCreationService.new.execute(cluster)
        else
          return cluster.errored!("Unexpected operation status; #{operation.status} #{operation.status_message}")
        end
      end
    end
  end
end
