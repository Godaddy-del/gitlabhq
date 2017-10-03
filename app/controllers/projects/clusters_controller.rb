class Projects::ClustersController < Projects::ApplicationController
  before_action :cluster, except: [:login, :index, :new, :create]
  before_action :authorize_read_cluster!
  before_action :authorize_create_cluster!, only: [:new, :create]
  before_action :authorize_google_api, only: [:new, :create]
  before_action :authorize_update_cluster!, only: [:update]
  before_action :authorize_admin_cluster!, only: [:destroy]

  def login
    begin
      @authorize_url = GoogleApi::CloudPlatform::Client.new(
          nil, callback_google_api_authorizations_url,
          state: namespace_project_clusters_url.to_s
        ).authorize_url
    rescue GoogleApi::Auth::ConfigMissingError
      # no-op
    end
  end

  def index
    if project.cluster
      redirect_to project_cluster_path(project, project.cluster)
    else
      redirect_to new_project_cluster_path(project)
    end
  end

  def new
    @cluster = project.build_cluster
  end

  def create
    @cluster = Ci::CreateClusterService
      .new(project, current_user, cluster_params)
      .execute(token_in_session)

    if @cluster.persisted?
      redirect_to project_clusters_path(project)
    else
      render :new
    end
  end

  def status
    respond_to do |format|
      format.json do
        Gitlab::PollingInterval.set_header(response, interval: 10_000)

        render json: {
          status: cluster.status, # The current status of the operation.
          status_reason: cluster.status_reason # If an error has occurred, a textual description of the error.
        }
      end
    end
  end

  def show
  end

  def update
    Ci::UpdateClusterService
      .new(project, current_user, cluster_params)
      .execute(cluster)

    render :show
  end

  def destroy
    if cluster.destroy
      redirect_to project_clusters_path(project), status: 302
    else
      render :show
    end
  end

  private

  def cluster
    @cluster ||= project.cluster
  end

  def cluster_params
    params.require(:cluster)
      .permit(:gcp_project_id, :gcp_cluster_zone, :gcp_cluster_name, :gcp_cluster_size,
              :gcp_machine_type, :project_namespace, :enabled)
  end

  def authorize_google_api
    unless GoogleApi::CloudPlatform::Client.new(token_in_session, nil)
                                           .validate_token(expires_at_in_session)
      redirect_to action: 'login'
    end
  end

  def token_in_session
    @token_in_session ||=
      session[GoogleApi::CloudPlatform::Client.session_key_for_token]
  end

  def expires_at_in_session
    @expires_at_in_session ||=
      session[GoogleApi::CloudPlatform::Client.session_key_for_expires_at]
  end

  def authorize_update_cluster!
    return access_denied! unless can?(current_user, :update_cluster, cluster)
  end

  def authorize_admin_cluster!
    return access_denied! unless can?(current_user, :admin_cluster, cluster)
  end
end
